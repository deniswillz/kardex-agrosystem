import React, { useState, useEffect } from 'react';
import { User, Plus, Pencil, Trash2, Shield, UserCheck, Loader2, X, Save, Eye, EyeOff } from 'lucide-react';
import { useAuth } from './AuthContext';

interface UserData {
    id: string;
    name: string;
    username: string;
    role: 'admin' | 'operador';
}

export const UserManagement: React.FC = () => {
    const { user, createUser, listUsers, updateUserRole, updateUserPassword, deleteUser } = useAuth();

    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);

    // Form fields
    const [formUsername, setFormUsername] = useState('');
    const [formName, setFormName] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formRole, setFormRole] = useState<'admin' | 'operador'>('operador');
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    // Load users on mount
    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        const data = await listUsers();
        setUsers(data);
        setLoading(false);
    };

    const resetForm = () => {
        setFormUsername('');
        setFormName('');
        setFormPassword('');
        setFormRole('operador');
        setFormError(null);
        setShowForm(false);
        setEditingUser(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setFormLoading(true);

        try {
            if (editingUser) {
                // Update role and optionally password
                let hasError = false;

                // Update role
                const roleResult = await updateUserRole(editingUser.id, formRole);
                if (roleResult.error) {
                    setFormError(roleResult.error);
                    hasError = true;
                }

                // Update password if provided
                if (!hasError && formPassword && formPassword.length >= 6) {
                    const pwResult = await updateUserPassword(editingUser.id, formPassword);
                    if (pwResult.error) {
                        setFormError(pwResult.error);
                        hasError = true;
                    }
                } else if (formPassword && formPassword.length < 6) {
                    setFormError('Senha deve ter no mínimo 6 caracteres');
                    hasError = true;
                }

                if (!hasError) {
                    await loadUsers();
                    resetForm();
                }
            } else {
                // Create new user
                if (!formUsername || !formName || !formPassword) {
                    setFormError('Preencha todos os campos');
                    setFormLoading(false);
                    return;
                }

                if (formPassword.length < 6) {
                    setFormError('Senha deve ter no mínimo 6 caracteres');
                    setFormLoading(false);
                    return;
                }

                const result = await createUser(formUsername, formPassword, formName, formRole);
                if (result.error) {
                    setFormError(result.error);
                } else {
                    await loadUsers();
                    resetForm();
                }
            }
        } finally {
            setFormLoading(false);
        }
    };

    const handleEdit = (u: UserData) => {
        setEditingUser(u);
        setFormUsername(u.username);
        setFormName(u.name);
        setFormRole(u.role);
        setFormPassword('');
        setShowForm(true);
    };

    const handleDelete = async (u: UserData) => {
        if (u.id === user?.id) {
            alert('Você não pode remover seu próprio usuário');
            return;
        }

        if (window.confirm(`Remover usuário "${u.name}"?`)) {
            const result = await deleteUser(u.id);
            if (result.error) {
                alert(result.error);
            } else {
                await loadUsers();
            }
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Shield size={20} className="text-primary-600" />
                    Gerenciar Usuários
                    <span className="text-xs font-normal bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                        {users.length}
                    </span>
                </h2>

                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-primary-700 transition-colors"
                >
                    <Plus size={18} /> Novo Usuário
                </button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800">
                                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                            </h3>
                            <button onClick={resetForm} className="p-1 hover:bg-slate-100 rounded">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Login (Usuário) *
                                </label>
                                <input
                                    type="text"
                                    value={formUsername}
                                    onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                    placeholder="joao.silva"
                                    disabled={!!editingUser}
                                    required
                                />
                                {!editingUser && (
                                    <p className="text-[10px] text-slate-400 mt-1">Sem espaços ou caracteres especiais</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Nome Completo *
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                                    placeholder="João da Silva"
                                    disabled={!!editingUser}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    {editingUser ? 'Nova Senha (opcional)' : 'Senha *'}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formPassword}
                                        onChange={(e) => setFormPassword(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 pr-10"
                                        placeholder={editingUser ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}
                                        minLength={editingUser ? 0 : 6}
                                        required={!editingUser}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {editingUser && (
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Preencha apenas se quiser alterar a senha do usuário
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Nível de Acesso *
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormRole('operador')}
                                        className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${formRole === 'operador'
                                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                                            : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <UserCheck size={20} />
                                        <span className="text-sm font-medium">Operador</span>
                                        <span className="text-[10px] text-slate-500">Acesso padrão</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormRole('admin')}
                                        className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${formRole === 'admin'
                                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                                            : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <Shield size={20} />
                                        <span className="text-sm font-medium">Admin</span>
                                        <span className="text-[10px] text-slate-500">Acesso total</span>
                                    </button>
                                </div>
                            </div>

                            {formError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                    {formError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={formLoading}
                                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {formLoading ? (
                                    <Loader2 size={20} className="animate-spin" />
                                ) : (
                                    <>
                                        <Save size={18} />
                                        {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Users Table */}
            <div className="overflow-y-auto flex-1">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={32} className="text-primary-600 animate-spin" />
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Usuário</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nome</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Acesso</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
                                                <User size={20} />
                                            </div>
                                            <span className="font-mono text-sm text-slate-700">{u.username || u.name.toLowerCase().replace(/\s+/g, '.')}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-700">{u.name}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {u.role === 'admin' ? <Shield size={12} /> : <UserCheck size={12} />}
                                            {u.role === 'admin' ? 'Admin' : 'Operador'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(u)}
                                                className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(u)}
                                                disabled={u.id === user?.id}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Remover"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                                        Nenhum usuário cadastrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
