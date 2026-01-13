import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, Package, Activity, AlertTriangle } from 'lucide-react';
import { DashboardStats } from '../types';

interface StatsCardsProps {
  stats: DashboardStats;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Saldo Total</p>
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
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Entradas Hoje</p>
          <h3 className="text-2xl font-bold text-emerald-600">+{stats.entriesToday}</h3>
        </div>
        <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
          <ArrowUpCircle size={24} />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Saídas Hoje</p>
          <h3 className="text-2xl font-bold text-red-600">-{stats.exitsToday}</h3>
        </div>
        <div className="p-3 bg-red-50 rounded-full text-red-600">
          <ArrowDownCircle size={24} />
        </div>
      </div>

      {/* New Critical Items Card */}
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
  );
};
