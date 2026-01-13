import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tbmnirltybhjttcdtllw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibW5pcmx0eWJoanR0Y2R0bGx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxODkyMjEsImV4cCI6MjA4Mzc2NTIyMX0.EmocGQ8q8EmlbLlFTQOgdYLWiVQqZKiNToQ_veihUpQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Types for Supabase
export interface Profile {
  id: string;
  name: string;
  role: 'admin' | 'operador';
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category_id: number | null;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionDB {
  id: string;
  date: string;
  product_id: string | null;
  code: string;
  name: string;
  type: 'ENTRADA' | 'SAIDA';
  quantity: number;
  warehouse: string;
  address: string | null;
  responsible: string | null;
  category_id: number | null;
  photos: string[] | null;
  created_at: string;
  user_id: string | null;
}
