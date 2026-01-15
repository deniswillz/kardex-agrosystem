import { supabase, TransactionDB } from './supabase';
import { Transaction } from '../types';

const STORAGE_KEY = 'kardex_pro_v3_data';
const MIGRATION_KEY = 'kardex_migrated_to_supabase';

// Check if we have local data to migrate
export const hasLocalData = (): boolean => {
  const data = localStorage.getItem(STORAGE_KEY);
  const migrated = localStorage.getItem(MIGRATION_KEY);
  return !!data && !migrated && JSON.parse(data).length > 0;
};

// Load from localStorage (legacy)
export const loadLocalTransactions = (): Transaction[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load local data", error);
    return [];
  }
};

// Mark as migrated
export const markAsMigrated = () => {
  localStorage.setItem(MIGRATION_KEY, 'true');
};

// Load transactions from Supabase
export const loadTransactions = async (): Promise<Transaction[]> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase load error:', error);
      // Fallback to localStorage
      return loadLocalTransactions();
    }

    // Transform to app format
    return (data || []).map((t: TransactionDB) => ({
      id: t.id,
      date: t.date,
      code: t.code,
      name: t.name,
      type: t.type,
      quantity: t.quantity,
      warehouse: t.warehouse,
      address: t.address || undefined,
      responsible: t.responsible || undefined,
      photos: t.photos || [],
      timestamp: new Date(t.created_at).getTime(),
      category_id: t.category_id || undefined,
      user_id: t.user_id || undefined
    }));
  } catch (error) {
    console.error("Failed to load from Supabase", error);
    return loadLocalTransactions();
  }
};

// Save a single transaction to Supabase
export const saveTransaction = async (
  transaction: Omit<Transaction, 'id' | 'timestamp'>,
  userId?: string
): Promise<Transaction | null> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        date: transaction.date,
        code: transaction.code.toUpperCase(),
        name: transaction.name,
        type: transaction.type,
        quantity: transaction.quantity,
        warehouse: transaction.warehouse,
        address: transaction.address || null,
        responsible: transaction.responsible || null,
        category_id: transaction.category_id || null,
        photos: transaction.photos || [],
        user_id: userId || null
      })
      .select()
      .single();

    if (error) {
      console.error('Save error:', error);
      return null;
    }

    return {
      id: data.id,
      date: data.date,
      code: data.code,
      name: data.name,
      type: data.type,
      quantity: data.quantity,
      warehouse: data.warehouse,
      address: data.address || undefined,
      responsible: data.responsible || undefined,
      photos: data.photos || [],
      timestamp: new Date(data.created_at).getTime(),
      category_id: data.category_id || undefined,
      user_id: data.user_id || undefined
    };
  } catch (error) {
    console.error("Failed to save to Supabase", error);
    return null;
  }
};

// Update a transaction
export const updateTransaction = async (
  id: string,
  transaction: Omit<Transaction, 'id' | 'timestamp'>
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('transactions')
      .update({
        date: transaction.date,
        code: transaction.code.toUpperCase(),
        name: transaction.name,
        type: transaction.type,
        quantity: transaction.quantity,
        warehouse: transaction.warehouse,
        address: transaction.address || null,
        responsible: transaction.responsible || null,
        category_id: transaction.category_id || null,
        photos: transaction.photos || []
      })
      .eq('id', id);

    if (error) {
      console.error('Update error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to update in Supabase", error);
    return false;
  }
};

// Delete a transaction
export const deleteTransaction = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to delete from Supabase", error);
    return false;
  }
};

// Migrate local data to Supabase
export const migrateLocalToSupabase = async (userId: string): Promise<number> => {
  const localData = loadLocalTransactions();

  if (localData.length === 0) {
    markAsMigrated();
    return 0;
  }

  let migrated = 0;

  for (const t of localData) {
    const { error } = await supabase
      .from('transactions')
      .insert({
        date: t.date,
        code: t.code.toUpperCase(),
        name: t.name,
        type: t.type,
        quantity: t.quantity,
        warehouse: t.warehouse,
        address: t.address || null,
        responsible: t.responsible || null,
        category_id: t.category_id || null,
        photos: t.photos || [],
        user_id: userId
      });

    if (!error) {
      migrated++;
    } else {
      console.error('Migration error for item:', t.code, error);
    }
  }

  if (migrated > 0) {
    markAsMigrated();
  }

  return migrated;
};

// Get products with stock info (for min_stock alerts)
export const getProductsStock = async (): Promise<Map<string, { min_stock: number; category_id?: number }>> => {
  const map = new Map();

  try {
    const { data, error } = await supabase
      .from('products')
      .select('code, min_stock, category_id');

    if (!error && data) {
      data.forEach(p => {
        map.set(p.code, { min_stock: p.min_stock, category_id: p.category_id });
      });
    }
  } catch (e) {
    console.error('Failed to load products:', e);
  }

  return map;
};

// Save or update product min_stock
export const saveProductMinStock = async (
  code: string,
  name: string,
  minStock: number,
  categoryId?: number
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('products')
      .upsert({
        code: code.toUpperCase(),
        name,
        min_stock: minStock,
        category_id: categoryId || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'code'
      });

    return !error;
  } catch (e) {
    console.error('Failed to save product:', e);
    return false;
  }
};

// Legacy localStorage functions for backward compatibility
export const saveTransactions = (transactions: Transaction[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error("Failed to save data", error);
  }
};

// Export to JSON
export const exportToJson = (transactions: Transaction[]) => {
  const dataStr = JSON.stringify(transactions, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup_kardex_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
// Clear all data (ADMIN only)
export const clearAllData = async (): Promise<boolean> => {
  try {
    // 1. Delete all transactions
    // Since Supabase requires a filter for DELETE, we use a filter that matches everything
    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .not('id', 'is', null);

    if (txError) throw txError;

    // 2. Clear localStorage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MIGRATION_KEY);

    return true;
  } catch (error) {
    console.error("Failed to clear all data", error);
    return false;
  }
};
