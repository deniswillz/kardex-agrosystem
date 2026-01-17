export type MovementType = 'ENTRADA' | 'SAIDA';

export interface Transaction {
  id: string;
  date: string; // ISO Date string YYYY-MM-DD
  code: string;
  name: string;
  type: MovementType;
  quantity: number;
  warehouse: string; // Origin or Destination
  address?: string; // Shelf/Row location
  responsible?: string;
  photos: string[]; // URLs from Supabase Storage or Base64 for legacy
  timestamp: number; // For sorting
  category_id?: number; // Category reference
  min_stock?: number; // Minimum stock for alerts
  user_id?: string; // User who created the transaction
  unit?: string; // Unit of measure (UN, KG, etc.)
}

export interface StockSummary {
  code: string;
  name: string;
  totalEntry: number;
  totalExit: number;
  balance: number;
  lastUpdated: string;
  category_id?: number;
  min_stock?: number;
}

export interface DashboardStats {
  totalStockCount: number; // Sum of all balances
  totalTransactions: number;
  entriesToday: number;
  exitsToday: number;
  criticalItems: number; // Items below min_stock
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operador';
}

export interface Category {
  id: number;
  name: string;
  color: string;
}

export interface Product {
  code: string;
  name: string;
  category_id?: number;
  min_stock: number;
}