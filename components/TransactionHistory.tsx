import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { Search, Filter, Trash2, MapPin, Calendar, User, Pencil, X, ClipboardList, ArrowUpDown } from 'lucide-react';
import { OPERATION_TYPES_LIST, getOperationTypeName, getOperationTypeColor } from '../constants/categories';

interface TransactionHistoryProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions, onDelete, onEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'ENTRADA' | 'SAIDA'>('ALL');

  // Advanced filters
  const [filterOperationType, setFilterOperationType] = useState<number | 'ALL'>('ALL');
  const [filterResponsible, setFilterResponsible] = useState<string>('ALL');
  const [filterWarehouse, setFilterWarehouse] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Get unique values for filter dropdowns
  const uniqueResponsibles = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      if (t.responsible) set.add(t.responsible);
    });
    return Array.from(set).sort();
  }, [transactions]);

  const uniqueWarehouses = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => {
      if (t.warehouse) set.add(t.warehouse);
    });
    return Array.from(set).sort();
  }, [transactions]);

  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      // Search filter
      const matchesSearch =
        t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.warehouse.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.responsible?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

      // Type filter (only for Movimentação)
      const isContagem = t.category_id === 2;
      let matchesType = true;
      if (filterType !== 'ALL' && !isContagem) {
        matchesType = t.type === filterType;
      }

      // Operation type filter
      const matchesOperationType = filterOperationType === 'ALL' || t.category_id === filterOperationType || (!t.category_id && filterOperationType === 1);

      // Responsible filter
      const matchesResponsible = filterResponsible === 'ALL' || t.responsible === filterResponsible;

      // Warehouse filter
      const matchesWarehouse = filterWarehouse === 'ALL' || t.warehouse === filterWarehouse;

      // Date range filter
      let matchesDateRange = true;
      if (dateFrom) {
        matchesDateRange = matchesDateRange && t.date >= dateFrom;
      }
      if (dateTo) {
        matchesDateRange = matchesDateRange && t.date <= dateTo;
      }

      // Show warehouses 01, 20, 22 for ENTRADA, but all warehouses for SAIDA
      const isAllowedWarehouse = ['01', '20', '22'].some(w => t.warehouse?.includes(w));
      const showInHistory = isAllowedWarehouse || t.type === 'SAIDA';

      return matchesSearch && matchesType && matchesOperationType && matchesResponsible && matchesWarehouse && matchesDateRange && showInHistory;
    }).sort((a, b) => a.code.localeCompare(b.code));
  }, [transactions, searchTerm, filterType, filterOperationType, filterResponsible, filterWarehouse, dateFrom, dateTo]);

  const hasActiveFilters = filterOperationType !== 'ALL' || filterResponsible !== 'ALL' || filterWarehouse !== 'ALL' || dateFrom || dateTo;

  const clearFilters = () => {
    setFilterOperationType('ALL');
    setFilterResponsible('ALL');
    setFilterWarehouse('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const getTypeBadge = (t: Transaction) => {
    const isContagem = t.category_id === 2;
    if (isContagem) {
      return { text: 'CONTAGEM', bg: 'bg-purple-100', color: 'text-purple-800' };
    }
    return t.type === 'ENTRADA'
      ? { text: 'ENTRADA', bg: 'bg-emerald-100', color: 'text-emerald-800' }
      : { text: 'SAÍDA', bg: 'bg-red-100', color: 'text-red-800' };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 space-y-3">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            Histórico
            <span className="text-xs font-normal bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{filteredData.length}</span>
          </h2>

          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-48"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <option value="ALL">Todos</option>
              <option value="ENTRADA">Entradas</option>
              <option value="SAIDA">Saídas</option>
            </select>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${showAdvancedFilters || hasActiveFilters
                ? 'bg-primary-100 text-primary-700 border border-primary-200'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
            >
              <Filter size={16} />
              Filtros
              {hasActiveFilters && (
                <span className="ml-1 w-2 h-2 rounded-full bg-primary-500"></span>
              )}
            </button>
          </div>
        </div>

        {/* Advanced filters panel */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            {/* Operation Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo Operação</label>
              <select
                value={filterOperationType === 'ALL' ? 'ALL' : filterOperationType}
                onChange={(e) => setFilterOperationType(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="ALL">Todas</option>
                {OPERATION_TYPES_LIST.map(op => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
            </div>

            {/* Responsible */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Responsável</label>
              <select
                value={filterResponsible}
                onChange={(e) => setFilterResponsible(e.target.value)}
                className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="ALL">Todos</option>
                {uniqueResponsibles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Warehouse */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Local</label>
              <select
                value={filterWarehouse}
                onChange={(e) => setFilterWarehouse(e.target.value)}
                className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="ALL">Todos</option>
                {uniqueWarehouses.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Início</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Fim</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full text-xs px-2 py-1.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Clear button */}
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="w-full px-2 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <X size={12} /> Limpar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-y-auto flex-1 p-0">
        {/* Desktop Table */}
        <table className="w-full hidden md:table">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Item</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Operação</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Local</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredData.map((t) => {
              const typeBadge = getTypeBadge(t);
              const isContagem = t.category_id === 2;

              return (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200">
                        {t.photos && t.photos.length > 0 ? (
                          <img src={t.photos[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-slate-400 text-xs font-bold">{t.code.slice(0, 2)}</span>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-slate-900">{t.name}</div>
                        <span className="text-xs text-slate-500">{t.code}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${typeBadge.bg} ${typeBadge.color}`}>
                      {isContagem && <ClipboardList size={12} className="mr-1" />}
                      {typeBadge.text}
                    </span>
                    <div className="text-sm font-bold text-slate-700 mt-1">
                      {isContagem ? '' : (t.type === 'SAIDA' ? '-' : '+')}{t.quantity} un
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-700">{t.warehouse}</span>
                      {t.address && <span className="text-xs text-slate-400">Ref: {t.address}</span>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">{new Date(t.date).toLocaleDateString()}</span>
                        {t.responsible && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <User size={10} /> {t.responsible}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(t)}
                        className="text-slate-400 hover:text-primary-600 transition-colors p-2 rounded-full hover:bg-primary-50"
                        title="Editar"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Tem certeza que deseja apagar este registro?')) onDelete(t.id);
                        }}
                        className="text-slate-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3 p-4">
          {filteredData.map((t) => {
            const typeBadge = getTypeBadge(t);
            const isContagem = t.category_id === 2;

            return (
              <div key={t.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm relative">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-slate-100 rounded-md flex items-center justify-center overflow-hidden border border-slate-200">
                      {t.photos && t.photos.length > 0 ? (
                        <img src={t.photos[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-slate-400 text-xs font-bold">{t.code.slice(0, 2)}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{t.name}</h3>
                      <p className="text-xs text-slate-500">{t.code}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded flex items-center gap-1 ${typeBadge.bg} ${typeBadge.color}`}>
                    {isContagem && <ClipboardList size={10} />}
                    {isContagem ? '' : (t.type === 'ENTRADA' ? '+' : '-')}{t.quantity}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-3">
                  <div className="flex items-center gap-1">
                    <MapPin size={12} className="text-slate-400" /> {t.warehouse}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" /> {new Date(t.date).toLocaleDateString()}
                  </div>
                  {t.responsible && (
                    <div className="flex items-center gap-1 col-span-2">
                      <User size={12} className="text-slate-400" /> {t.responsible}
                    </div>
                  )}
                  {isContagem && (
                    <div className="flex items-center gap-1 col-span-2">
                      <ClipboardList size={12} className="text-purple-400" />
                      <span className="text-purple-600 font-medium">Contagem de Verificação</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-2 border-t border-slate-100 pt-2">
                  <button
                    onClick={() => onEdit(t)}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-600 px-2 py-1 rounded hover:bg-primary-50"
                  >
                    <Pencil size={14} /> Editar
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Apagar registro?')) onDelete(t.id);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-red-500 px-2 py-1 rounded hover:bg-red-50"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            );
          })}
          {filteredData.length === 0 && (
            <div className="text-center py-10 text-slate-500">Nenhum registro.</div>
          )}
        </div>
      </div>
    </div>
  );
};