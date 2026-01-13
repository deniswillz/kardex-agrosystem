import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Transaction } from '../types';

interface DashboardProps {
  transactions: Transaction[];
}

export const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
  // Process data for charts
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const chartData = last7Days.map(date => {
    const dayMoves = transactions.filter(t => t.date === date);
    return {
      name: date.split('-').slice(1).join('/'), // MM/DD
      Entrada: dayMoves.filter(t => t.type === 'ENTRADA').reduce((a, b) => a + b.quantity, 0),
      Saida: dayMoves.filter(t => t.type === 'SAIDA').reduce((a, b) => a + b.quantity, 0)
    };
  });

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-96 flex flex-col">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Movimentação (Últimos 7 dias)</h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="Entrada" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
            <Bar dataKey="Saida" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
