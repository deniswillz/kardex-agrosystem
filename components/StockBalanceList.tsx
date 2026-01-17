import React, { useMemo, useState } from 'react';
import { Transaction } from '../types';
import { Search, Package, ArrowRightLeft, AlertTriangle, Filter } from 'lucide-react';
import { operationAffectsStock } from '../constants/categories';

interface StockBalanceListProps {
    transactions: Transaction[];
    onSelectCode: (code: string) => void;
    onUpdateMinStock?: (code: string, name: string, minStock: number) => Promise<void>;
}

// Only show these warehouses
const ALLOWED_WAREHOUSES = ['01', '20', '22'];

export const StockBalanceList: React.FC<StockBalanceListProps> = ({
    transactions,
    onSelectCode,
    onUpdateMinStock
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'OK' | 'CRITICAL' | 'NEGATIVE'>('ALL');

    // Calculate stock by code + address (detailed view - items can appear multiple times)
    const stockByAddress = useMemo(() => {
        const map: Record<string, {
            code: string;
            name: string;
            warehouse: string;
            address: string;
            unit: string;
            balance: number;
            min_stock: number;
        }> = {};

        // Filter only allowed warehouses and stock-affecting operations
        const filteredTx = transactions.filter(t =>
            ALLOWED_WAREHOUSES.some(w => t.warehouse.includes(w)) &&
            operationAffectsStock(t.category_id)
        );

        filteredTx.forEach(t => {
            const key = `${t.code}|${t.warehouse}|${t.address || 'Sem endereço'}`;

            if (!map[key]) {
                map[key] = {
                    code: t.code,
                    name: t.name,
                    warehouse: t.warehouse,
                    address: t.address || 'Sem endereço',
                    unit: t.unit || 'UN',
                    balance: 0,
                    min_stock: t.min_stock || 0
                };
            }

            // Update balance
            if (t.type === 'ENTRADA') {
                map[key].balance += t.quantity;
            } else {
                map[key].balance -= t.quantity;
            }

            // Update min_stock if higher
            if (t.min_stock && t.min_stock > map[key].min_stock) {
                map[key].min_stock = t.min_stock;
            }
        });

        return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
    }, [transactions]);

    // Filter by search and status
    const filteredStock = useMemo(() => {
        return stockByAddress.filter(item => {
            const matchesSearch =
                item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.address.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (filterStatus === 'NEGATIVE') return item.balance < 0;
            if (filterStatus === 'CRITICAL') return item.min_stock > 0 && item.balance <= item.min_stock && item.balance >= 0;
            if (filterStatus === 'OK') return item.balance > item.min_stock;
            return true;
        });
    }, [stockByAddress, searchTerm, filterStatus]);

    const getStatusBadge = (item: typeof stockByAddress[0]) => {
        if (item.balance < 0) return { color: 'text-red-700', bg: 'bg-red-100', icon: true };
        if (item.min_stock > 0 && item.balance <= item.min_stock) return { color: 'text-amber-700', bg: 'bg-amber-100', icon: true };
        return { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: false };
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Package className="text-primary-600" /> Saldo em Estoque
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            {filteredStock.length} registros • Armazéns: 01, 20, 22
                        </p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar código, item ou endereço..."
                                className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl w-full sm:w-64 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="ALL">Todos</option>
                            <option value="OK">OK</option>
                            <option value="CRITICAL">Crítico</option>
                            <option value="NEGATIVE">Negativo</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1 p-0">
                <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Código/Item</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">Armazém</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Endereço</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">UN</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Saldo</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Mínimo</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {filteredStock.map((item, idx) => {
                            const status = getStatusBadge(item);
                            return (
                                <tr key={`${item.code}-${item.address}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-primary-100 text-primary-600">
                                                <Package size={16} />
                                            </div>
                                            <div className="ml-3">
                                                <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                                                <div className="text-xs text-slate-500">{item.code}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 hidden lg:table-cell">
                                        {item.warehouse}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                                        {item.address}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center text-xs text-slate-500 hidden sm:table-cell">
                                        {item.unit}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                        <span className={`px-2 py-1 inline-flex text-sm leading-5 font-bold rounded-full ${status.bg} ${status.color}`}>
                                            {item.balance} {item.unit}
                                            {status.icon && <AlertTriangle size={14} className="ml-1" />}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm hidden sm:table-cell">
                                        <span className={item.min_stock > 0 ? "text-amber-600 font-medium" : "text-slate-400"}>
                                            {item.min_stock || 0}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => onSelectCode(item.code)}
                                            className="text-primary-600 hover:text-primary-900 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                            title="Nova movimentação"
                                        >
                                            <ArrowRightLeft size={16} /> <span className="hidden sm:inline">Movimentar</span>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredStock.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                                    Nenhum item encontrado nos armazéns 01, 20 ou 22.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
