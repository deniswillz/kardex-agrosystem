import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, Package, Activity, AlertTriangle } from 'lucide-react';
import { DashboardStats } from '../types';

interface CriticalItem {
  code: string;
  name: string;
  balance: number;
  min_stock: number;
}

interface StatsCardsProps {
  stats: DashboardStats;
  dateFilter: '7d' | '15d' | '30d' | '90d' | 'ALL';
  onFilterChange: (filter: '7d' | '15d' | '30d' | '90d' | 'ALL') => void;
  criticalItemsList?: CriticalItem[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, dateFilter, onFilterChange, criticalItemsList = [] }) => {
  return (
    <div className="space-y-4 mb-6">
      <div className="flex justify-end">
        <select
          value={dateFilter}
          onChange={(e) => onFilterChange(e.target.value as any)}
          className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5"
        >
          <option value="ALL">Todo o Período</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="15d">Últimos 15 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
        </select>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Produtos</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.totalStockCount}</h3>
          </div>
          <div className="p-3 bg-blue-50 rounded-full text-blue-600">
            <Package size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Movimentos</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats.totalTransactions}</h3>
          </div>
          <div className="p-3 bg-purple-50 rounded-full text-purple-600">
            <Activity size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Entradas</p>
            <h3 className="text-2xl font-bold text-emerald-600">{stats.entriesToday}</h3>
          </div>
          <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
            <ArrowUpCircle size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Saídas</p>
            <h3 className="text-2xl font-bold text-red-600">{stats.exitsToday}</h3>
          </div>
          <div className="p-3 bg-red-50 rounded-full text-red-600">
            <ArrowDownCircle size={24} />
          </div>
        </div>

        {/* Critical Items Card */}
        <div className={`p-4 rounded-xl shadow-sm border flex items-center justify-between ${stats.criticalItems > 0
          ? 'bg-amber-50 border-amber-200'
          : 'bg-white border-slate-100'
          }`}>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Itens Críticos</p>
            <h3 className={`text-2xl font-bold ${stats.criticalItems > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {stats.criticalItems}
            </h3>
          </div>
          <div className={`p-3 rounded-full ${stats.criticalItems > 0
            ? 'bg-amber-100 text-amber-600 animate-pulse'
            : 'bg-slate-50 text-slate-400'
            }`}>
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Critical Items Alert List */}
      {criticalItemsList.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} className="text-red-600" />
            <h4 className="font-bold text-red-800">Produtos com Estoque Crítico</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {criticalItemsList.map(item => (
              <div key={item.code} className="bg-white rounded-lg p-3 border border-red-100 flex justify-between items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.code}</p>
                </div>
                <div className="text-right ml-2">
                  <p className="text-lg font-bold text-red-600">{item.balance}</p>
                  <p className="text-[10px] text-slate-400">Mín: {item.min_stock}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
