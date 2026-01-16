import React, { useMemo, useState, useRef } from 'react';
import { Transaction } from '../types';
import { Search, Package, ArrowRightLeft, AlertTriangle, Filter, ClipboardList, Upload, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { downloadInventoryTemplate, importInventoryFromExcel, InventoryImportItem } from '../services/excel';

interface InventoryListProps {
  transactions: Transaction[];
  onSelectCode: (code: string) => void;
  onImportInventory?: (items: InventoryImportItem[]) => Promise<void>;
}

export const InventoryList: React.FC<InventoryListProps> = ({ transactions, onSelectCode, onImportInventory }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OK' | 'CRITICAL' | 'NEGATIVE'>('ALL');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Aggregate items with min_stock info
  const inventory = useMemo(() => {
    const map: Record<string, {
      code: string;
      name: string;
      entries: number;
      exits: number;
      balance: number;
      lastDate: string;
      min_stock: number;
      contagens: number;
      lastContagem?: { quantity: number; date: string };
    }> = {};

    transactions.forEach(t => {
      if (!map[t.code]) {
        map[t.code] = {
          code: t.code,
          name: t.name,
          entries: 0,
          exits: 0,
          balance: 0,
          lastDate: t.date,
          min_stock: t.min_stock || 0,
          contagens: 0
        };
      }

      // Update to most recent values
      if (t.timestamp > new Date(map[t.code].lastDate).getTime()) {
        map[t.code].name = t.name;
        map[t.code].lastDate = t.date;
        if (t.min_stock) map[t.code].min_stock = t.min_stock;
      }

      // Check if it's a Contagem (category_id = 2)
      const isContagem = t.category_id === 2;

      if (isContagem) {
        map[t.code].contagens += 1;
        // Track last contagem
        if (!map[t.code].lastContagem || t.timestamp > new Date(map[t.code].lastContagem.date).getTime()) {
          map[t.code].lastContagem = { quantity: t.quantity, date: t.date };
        }
      } else {
        // Only Movimentação affects stock
        if (t.type === 'ENTRADA') {
          map[t.code].entries += t.quantity;
          map[t.code].balance += t.quantity;
        } else {
          map[t.code].exits += t.quantity;
          map[t.code].balance -= t.quantity;
        }
      }
    });

    return Object.values(map).sort((a, b) => a.code.localeCompare(b.code));
  }, [transactions]);

  // Calculate critical items count
  const criticalCount = useMemo(() => {
    return inventory.filter(item =>
      item.balance < 0 || (item.min_stock > 0 && item.balance <= item.min_stock)
    ).length;
  }, [inventory]);

  // Filter inventory
  const filteredInventory = inventory.filter(item => {
    const matchesSearch =
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (filterStatus === 'OK') {
      matchesStatus = item.balance > 0 && (item.min_stock === 0 || item.balance > item.min_stock);
    } else if (filterStatus === 'CRITICAL') {
      matchesStatus = item.min_stock > 0 && item.balance > 0 && item.balance <= item.min_stock;
    } else if (filterStatus === 'NEGATIVE') {
      matchesStatus = item.balance < 0;
    }

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (item: typeof inventory[0]) => {
    if (item.balance < 0) {
      return { text: 'Negativo', bg: 'bg-red-100', color: 'text-red-700', icon: true };
    }
    if (item.min_stock > 0 && item.balance <= item.min_stock) {
      return { text: 'Crítico', bg: 'bg-amber-100', color: 'text-amber-700', icon: true };
    }
    return { text: 'OK', bg: 'bg-emerald-100', color: 'text-emerald-700', icon: false };
  };

  // Handle file import
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const items = await importInventoryFromExcel(file);

      if (items.length === 0) {
        setImportResult({ count: 0, message: 'Nenhum item válido encontrado no arquivo.' });
        setIsImporting(false);
        return;
      }

      if (onImportInventory) {
        await onImportInventory(items);
        setImportResult({
          count: items.length,
          message: `${items.length} itens importados com sucesso!`
        });
      } else {
        setImportResult({
          count: items.length,
          message: `${items.length} itens encontrados. Configure o handler de importação.`
        });
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      setImportResult({ count: 0, message: 'Erro ao importar arquivo. Verifique o formato.' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 space-y-3">
        {/* Import Result Notification */}
        {importResult && (
          <div className={`p-3 rounded-lg flex items-center justify-between ${importResult.count > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
            <span className="text-sm font-medium">{importResult.message}</span>
            <button
              onClick={() => setImportResult(null)}
              className="text-current opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            Itens em Estoque
            <span className="text-xs font-normal bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
              {filteredInventory.length}
            </span>
            {criticalCount > 0 && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle size={12} /> {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2">
            {/* Import Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              {isImporting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              <span className="hidden sm:inline">Importar Excel</span>
            </button>

            {/* Download Template */}
            <button
              onClick={downloadInventoryTemplate}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <FileSpreadsheet size={16} />
              <span className="hidden sm:inline">Modelo</span>
            </button>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".xlsx, .xls"
              className="hidden"
            />

            {/* Search */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="ALL">Todos status</option>
              <option value="OK">✓ Estoque OK</option>
              <option value="CRITICAL">⚠ Crítico</option>
              <option value="NEGATIVE">✗ Negativo</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-0">
        <table className="w-full">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Código/Item</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Entradas</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Saídas</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Saldo</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Contagens</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Ação</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredInventory.map((item) => {
              const status = getStatusBadge(item);
              return (
                <tr key={item.code} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center bg-primary-100 text-primary-600">
                        <Package size={20} />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-emerald-600 hidden md:table-cell">
                    +{item.entries}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600 hidden md:table-cell">
                    -{item.exits}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-1 inline-flex text-sm leading-5 font-bold rounded-full ${status.bg} ${status.color}`}>
                        {item.balance} un
                        {status.icon && <AlertTriangle size={14} className="ml-1" />}
                      </span>
                      {item.min_stock > 0 && (
                        <span className="text-[10px] text-slate-400">
                          mín: {item.min_stock}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center hidden sm:table-cell">
                    {item.contagens > 0 ? (
                      <div className="flex flex-col items-center">
                        <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                          <ClipboardList size={12} /> {item.contagens}
                        </span>
                        {item.lastContagem && (
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Última: {item.lastContagem.quantity} un
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => onSelectCode(item.code)}
                      className="text-primary-600 hover:text-primary-900 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                    >
                      <ArrowRightLeft size={16} /> <span className="hidden sm:inline">Movimentar</span>
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredInventory.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                  Nenhum item encontrado. Registre uma movimentação para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};