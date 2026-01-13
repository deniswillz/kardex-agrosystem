import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase, Profile } from '../services/supabase';

interface User {
    id: string;
    email: string;
    username: string;
    name: string;
    role: 'admin' | 'operador';
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (username: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    createUser: (username: string, password: string, name: string, role: 'admin' | 'operador') => Promise<{ error: string | null }>;
    listUsers: () => Promise<User[]>;
    updateUserRole: (userId: string, role: 'admin' | 'operador') => Promise<{ error: string | null }>;
    deleteUser: (userId: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const usernameToEmail = (username: string): string => {
    return `${username.toLowerCase().replace(/\s+/g, '_')}@kardex.local`;
};

const emailToUsername = (email: string): string => {
    return email.replace('@kardex.local', '').replace(/_/g, ' ');
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);
    const initializedRef = useRef(false);
    const loadingProfileRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        initializedRef.current = false;

        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.warn('Session check warning:', error.message);
                }

                if (!mountedRef.current) return;

                if (session?.user) {
                    await loadUserProfile(session.user.id, session.user.email || '');
                }
            } catch (err) {
                console.error('Auth init error:', err);
            } finally {
                if (mountedRef.current) {
                    initializedRef.current = true;
                    setLoading(false);
                }
            }
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mountedRef.current) return;

            // Skip INITIAL_SESSION event as getSession handles it
            if (event === 'INITIAL_SESSION') {
                return;
            }

            if (event === 'SIGNED_IN' && session?.user) {
                // Only load profile if already initialized (to avoid duplicate calls)
                if (initializedRef.current) {
                    await loadUserProfile(session.user.id, session.user.email || '');
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                // Silently handle token refresh without reloading profile
                console.log('Token refreshed');
            }
        });

        return () => {
            mountedRef.current = false;
            subscription.unsubscribe();
        };
    }, []);

    const loadUserProfile = async (userId: string, email: string) => {
        if (!mountedRef.current) return;

        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (!mountedRef.current) return;

            const username = emailToUsername(email);

            if (error) {
                console.warn('Profile not found, using default:', error.message);
                setUser({
                    id: userId,
                    email,
                    username,
                    name: username,
                    role: 'operador'
                });
            } else {
                setUser({
                    id: userId,
                    email,
                    username,
                    name: profile.name || username,
                    role: (profile.role as 'admin' | 'operador') || 'operador'
                });
            }
        } catch (err) {
            console.error('Load profile error:', err);
            if (mountedRef.current) {
                const username = emailToUsername(email);
                setUser({
                    id: userId,
                    email,
                    username,
                    name: username,
                    role: 'operador'
                });
            }
        }
    };

    const signIn = async (username: string, password: string): Promise<{ error: string | null }> => {
        try {
            const email = usernameToEmail(username);

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    return { error: 'Usuário ou senha incorretos' };
                }
                return { error: error.message };
            }

            if (data.user) {
                await loadUserProfile(data.user.id, data.user.email || '');
            }

            return { error: null };
        } catch (err: any) {
            return { error: err.message || 'Erro ao fazer login' };
        }
    };

    const signOut = async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
        } catch (err) {
            console.error('Sign out error:', err);
            setUser(null);
        }
    };

    const createUser = async (
        username: string,
        password: string,
        name: string,
        role: 'admin' | 'operador'
    ): Promise<{ error: string | null }> => {
        try {
            const email = usernameToEmail(username);

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name, username }
                }
            });

            if (error) {
                if (error.message.includes('already registered')) {
                    return { error: 'Este usuário já existe' };
                }
                return { error: error.message };
            }

            if (data.user) {
                await supabase
                    .from('profiles')
                    .upsert({
                        id: data.user.id,
                        name,
                        role
                    });
            }

            return { error: null };
        } catch (err: any) {
            return { error: err.message || 'Erro ao criar usuário' };
        }
    };

    const listUsers = async (): Promise<User[]> => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('List users error:', error);
                return [];
            }

            return (data || []).map(p => ({
                id: p.id,
                email: '',
                username: p.name?.toLowerCase().replace(/\s+/g, '_') || '',
                name: p.name || '',
                role: (p.role as 'admin' | 'operador') || 'operador'
            }));
        } catch (err) {
            console.error('List users error:', err);
            return [];
        }
    };

    const updateUserRole = async (userId: string, role: 'admin' | 'operador'): Promise<{ error: string | null }> => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role })
                .eq('id', userId);

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (err: any) {
            return { error: err.message || 'Erro ao atualizar usuário' };
        }
    };

    const deleteUser = async (userId: string): Promise<{ error: string | null }> => {
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (err: any) {
            return { error: err.message || 'Erro ao remover usuário' };
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            signIn,
            signOut,
            createUser,
            listUsers,
            updateUserRole,
            deleteUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};
