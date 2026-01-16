import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LayoutDashboard, List, Settings, Download, Menu, Plus, Upload, Package, LogOut, User, Cloud, Loader2 } from 'lucide-react';
import { Transaction, DashboardStats } from './types';
import {
  loadTransactions,
  saveTransaction,
  updateTransaction,
  deleteTransaction,
  hasLocalData,
  migrateLocalToSupabase,
  exportToJson,
  shouldRunAutoBackup,
  markBackupDone
} from './services/storage';
import { exportToExcel, importFromExcel, downloadTemplate, InventoryImportItem } from './services/excel';
import { StatsCards } from './components/StatsCards';
import { Dashboard } from './components/Dashboard';
import { MovementForm } from './components/MovementForm';
import { TransactionHistory } from './components/TransactionHistory';
import { InventoryList } from './components/InventoryList';
import { AuthProvider, useAuth } from './components/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { UserManagement } from './components/UserManagement';

function AppContent() {
  const { user, loading: authLoading, signOut } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [view, setView] = useState<'DASHBOARD' | 'HISTORY' | 'FORM' | 'INVENTORY' | 'SETTINGS'>('DASHBOARD');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'SYNCED' | 'SYNCING' | 'OFFLINE'>('SYNCED');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [presetCode, setPresetCode] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  const [dateFilter, setDateFilter] = useState<'7d' | '15d' | '30d' | '90d' | 'ALL'>('ALL');
  const [loadingImport, setLoadingImport] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  // Load data on mount
  useEffect(() => {
    mountedRef.current = true;

    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      if (!mountedRef.current) return;
      setIsLoading(true);
      setSyncStatus('SYNCING');

      try {
        // Check for local data to migrate
        if (hasLocalData()) {
          if (mountedRef.current) setShowMigrationModal(true);
        }

        const data = await loadTransactions();
        if (mountedRef.current) {
          setTransactions(data);
          setSyncStatus('SYNCED');
        }
      } catch (error) {
        console.error('Error loading data:', error);
        if (mountedRef.current) setSyncStatus('OFFLINE');
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      mountedRef.current = false;
    };
  }, [user]);

  // Auto-backup check at 17:45
  useEffect(() => {
    if (!user) return;

    const checkAutoBackup = async () => {
      if (shouldRunAutoBackup() && transactions.length > 0) {
        console.log('🕔 Auto-backup triggered at 17:45');
        exportToJson(transactions);
        markBackupDone();
      }
    };

    // Check immediately on load
    checkAutoBackup();

    // Check every minute
    const interval = setInterval(checkAutoBackup, 60000);

    return () => clearInterval(interval);
  }, [user, transactions]);

  // Handle migration
  const handleMigration = async (shouldMigrate: boolean) => {
    setShowMigrationModal(false);

    if (shouldMigrate && user) {
      setSyncStatus('SYNCING');
      try {
        const count = await migrateLocalToSupabase(user.id);
        alert(`${count} registros migrados com sucesso!`);
        // Reload data
        const data = await loadTransactions();
        setTransactions(data);
      } catch (error) {
        console.error('Migration error:', error);
        alert('Erro na migração. Tente novamente.');
      }
      setSyncStatus('SYNCED');
    }
  };

  const stats: DashboardStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    // Calculate date threshold based on filter
    let thresholdDate: Date | null = null;
    if (dateFilter !== 'ALL') {
      const days = parseInt(dateFilter);
      const date = new Date();
      date.setDate(date.getDate() - days);
      thresholdDate = date;
    }

    let minDateStr = thresholdDate ? thresholdDate.toISOString().split('T')[0] : '';

    // Filter transactions for stats aggregation (Entradas/Saidas)
    const filteredTransactions = transactions.filter(t => {
      if (!minDateStr) return true;
      return t.date >= minDateStr;
    });

    // For Critical Items and Product Count, we ALWAYS use ALL transactions to get the current real state
    // Build stock by product code
    const stockByCode: Record<string, { code: string; name: string; balance: number; min_stock: number }> = {};

    transactions.forEach(t => {
      const affectsStock = !t.category_id || t.category_id !== 2;

      if (!stockByCode[t.code]) {
        stockByCode[t.code] = { code: t.code, name: t.name, balance: 0, min_stock: t.min_stock || 0 };
      }

      if (affectsStock) {
        if (t.type === 'ENTRADA') {
          stockByCode[t.code].balance += t.quantity;
        } else {
          stockByCode[t.code].balance -= t.quantity;
        }
      }

      // Update min_stock if defined
      if (t.min_stock && t.min_stock > 0) {
        stockByCode[t.code].min_stock = t.min_stock;
      }
    });

    // Count unique products with positive balance
    const productsInStock = Object.values(stockByCode).filter(item => item.balance > 0).length;

    // Critical items: only those with min_stock > 0 AND balance <= min_stock
    const criticalItems = Object.values(stockByCode).filter(
      item => item.min_stock > 0 && item.balance <= item.min_stock
    ).length;

    // Count of movements in period (not sum of quantities)
    const entryMovementsCount = filteredTransactions.filter(t => t.type === 'ENTRADA' && (!t.category_id || t.category_id !== 2)).length;
    const exitMovementsCount = filteredTransactions.filter(t => t.type === 'SAIDA' && (!t.category_id || t.category_id !== 2)).length;

    return {
      totalStockCount: productsInStock, // Count of unique products with balance > 0
      totalTransactions: filteredTransactions.length, // Count of all movements
      entriesToday: entryMovementsCount, // Count of entry movements
      exitsToday: exitMovementsCount, // Count of exit movements
      criticalItems
    };
  }, [transactions, dateFilter]);

  // Separate memo for critical items list (for alert display)
  const criticalItemsList = useMemo(() => {
    const stockByCode: Record<string, { code: string; name: string; balance: number; min_stock: number }> = {};

    transactions.forEach(t => {
      const affectsStock = !t.category_id || t.category_id !== 2;

      if (!stockByCode[t.code]) {
        stockByCode[t.code] = { code: t.code, name: t.name, balance: 0, min_stock: t.min_stock || 0 };
      }

      if (affectsStock) {
        if (t.type === 'ENTRADA') {
          stockByCode[t.code].balance += t.quantity;
        } else {
          stockByCode[t.code].balance -= t.quantity;
        }
      }

      if (t.min_stock && t.min_stock > 0) {
        stockByCode[t.code].min_stock = t.min_stock;
      }
    });

    return Object.values(stockByCode)
      .filter(item => item.min_stock > 0 && item.balance <= item.min_stock)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [transactions]);

  const handleAddTransaction = async (newTx: Omit<Transaction, 'id' | 'timestamp'>) => {
    setSyncStatus('SYNCING');

    const saved = await saveTransaction(newTx, user?.id);

    if (saved) {
      setTransactions(prev => [saved, ...prev]);
      setSyncStatus('SYNCED');
    } else {
      // Fallback to local
      const transaction: Transaction = {
        ...newTx,
        id: crypto.randomUUID(),
        timestamp: Date.now()
      };
      setTransactions(prev => [transaction, ...prev]);
      setSyncStatus('OFFLINE');
    }

    setView('HISTORY');
    setPresetCode(undefined);
  };

  const handleUpdateTransaction = async (id: string, updatedTx: Omit<Transaction, 'id' | 'timestamp'>) => {
    setSyncStatus('SYNCING');

    const success = await updateTransaction(id, updatedTx);

    if (success) {
      setTransactions(prev => prev.map(t =>
        t.id === id ? { ...t, ...updatedTx } : t
      ));
      setSyncStatus('SYNCED');
    } else {
      setSyncStatus('OFFLINE');
    }

    setEditingTransaction(null);
    setView('HISTORY');
  };

  const handleDelete = async (id: string) => {
    setSyncStatus('SYNCING');

    const success = await deleteTransaction(id);

    if (success) {
      setTransactions(prev => prev.filter(t => t.id !== id));
      setSyncStatus('SYNCED');
    } else {
      setSyncStatus('OFFLINE');
    }
  };

  const startEditing = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setPresetCode(undefined);
    setView('FORM');
  };

  const handleSelectInventoryItem = (code: string) => {
    setEditingTransaction(null);
    setPresetCode(code);
    setView('FORM');
  };

  // Handle inventory import from Excel (Optimized)
  const handleInventoryImport = async (items: InventoryImportItem[]) => {
    setSyncStatus('SYNCING');
    setLoadingImport(true);
    const today = new Date().toISOString().split('T')[0];

    // Filter valid items
    const validItems = items.filter(item => item.quantity > 0);

    // Process in batches of 50 to allow parallelism without overwhelming Supabase
    const BATCH_SIZE = 50;
    const newTransactions: Transaction[] = [];

    try {
      for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
        const batch = validItems.slice(i, i + BATCH_SIZE);

        const promises = batch.map(item => {
          const txData = {
            date: today,
            code: item.code,
            name: item.name,
            type: 'ENTRADA' as const,
            quantity: item.quantity,
            warehouse: item.warehouse,
            address: item.address || '',
            responsible: user?.name || '',
            photos: [],
            min_stock: item.min_stock
          };
          return saveTransaction(txData, user?.id);
        });

        const results = await Promise.all(promises);

        // Collect successful saves
        results.forEach(res => {
          if (res) newTransactions.push(res);
        });
      }

      // Update state once at the end
      if (newTransactions.length > 0) {
        setTransactions(prev => [...newTransactions, ...prev]);
        alert(`${newTransactions.length} itens importados e atualizados com sucesso!`);
      } else {
        alert("Nenhum item novo foi salvo. Verifique se os itens têm quantidade > 0.");
      }

      setSyncStatus('SYNCED');
    } catch (error) {
      console.error("Critical error during bulk import:", error);
      alert("Ocorreu um erro durante a importação em massa. Alguns itens podem não ter sido salvos.");
      setSyncStatus('OFFLINE');
    } finally {
      setLoadingImport(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const importedData = await importFromExcel(file);
        if (importedData.length > 0) {
          if (window.confirm(`Encontrados ${importedData.length} registros. Adicionar ao sistema?`)) {
            setSyncStatus('SYNCING');

            for (const tx of importedData) {
              const { id, timestamp, ...txData } = tx;
              await saveTransaction(txData, user?.id);
            }

            // Reload data
            const data = await loadTransactions();
            setTransactions(data);
            setSyncStatus('SYNCED');

            alert(`Importação concluída com sucesso!`);
            setView('HISTORY');
          }
        } else {
          alert('Arquivo importado parece vazio ou formato inválido.');
        }
      } catch (error) {
        console.error(error);
        alert('Erro ao importar. Verifique se é um arquivo Excel (.xlsx) válido.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={40} className="text-primary-600 animate-spin" />
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <LoginScreen />;
  }

  const NavButton = ({ id, icon: Icon, label, active }: any) => (
    <button
      onClick={() => {
        setView(id);
        setIsMobileMenuOpen(false);
        if (id === 'FORM') {
          setEditingTransaction(null);
          setPresetCode(undefined);
        }
      }}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-medium ${active
        ? 'bg-primary-50 text-primary-700 shadow-sm'
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
        }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">

      {/* Migration Modal */}
      {showMigrationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Cloud size={32} className="text-primary-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Dados Locais Encontrados</h3>
              <p className="text-slate-600 mt-2">
                Encontramos dados salvos localmente. Deseja migrar para a nuvem?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleMigration(false)}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50"
              >
                Ignorar
              </button>
              <button
                onClick={() => handleMigration(true)}
                className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
              >
                Migrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="bg-primary-600 text-white p-1.5 rounded-lg">
            <LayoutDashboard size={20} />
          </div>
          <span className="font-bold text-slate-800">Kardex Pro</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-slate-100 rounded-lg">
          <Menu size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`fixed md:sticky md:top-0 h-screen w-64 bg-white border-r border-slate-200 z-40 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-primary-600 text-white p-2 rounded-xl shadow-lg shadow-primary-500/30">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Kardex Pro</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${syncStatus === 'SYNCED' ? 'bg-emerald-500' :
                  syncStatus === 'SYNCING' ? 'bg-amber-500 animate-pulse' :
                    'bg-red-500'
                  }`}></span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {syncStatus === 'SYNCED' ? 'Sincronizado' :
                    syncStatus === 'SYNCING' ? 'Sincronizando...' :
                      'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="mb-6 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
                <User size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.role === 'admin' ? 'Administrador' : 'Operador'}</p>
              </div>
            </div>
          </div>

          <nav className="space-y-1 flex-1">
            <NavButton id="DASHBOARD" icon={LayoutDashboard} label="Visão Geral" active={view === 'DASHBOARD'} />
            <NavButton id="INVENTORY" icon={Package} label="Estoque (Lista)" active={view === 'INVENTORY'} />
            <NavButton id="FORM" icon={Plus} label="Novo Movimento" active={view === 'FORM'} />
            <NavButton id="HISTORY" icon={List} label="Histórico" active={view === 'HISTORY'} />
            {user.role === 'admin' && (
              <NavButton id="SETTINGS" icon={Settings} label="Usuários" active={view === 'SETTINGS'} />
            )}
          </nav>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 overflow-y-auto">
            <h3 className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Backup & Dados</h3>
            <button
              onClick={() => exportToExcel(transactions)}
              className="flex items-center gap-3 w-full px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all font-medium text-sm"
            >
              <Download size={16} /> Exportar Excel
            </button>
            <button
              onClick={handleImportClick}
              className="flex items-center gap-3 w-full px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all font-medium text-sm"
            >
              <Upload size={16} /> Importar Excel
            </button>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-3 w-full px-4 py-2 rounded-xl text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm"
            >
              <Settings size={16} /> Baixar Modelo
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls"
              className="hidden"
            />

            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={signOut}
                className="flex items-center gap-3 w-full px-4 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-all font-medium text-sm"
              >
                <LogOut size={16} /> Sair
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-65px)] md:h-screen">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={40} className="text-primary-600 animate-spin" />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto h-full flex flex-col">

            {/* Header Area */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">
                  {view === 'DASHBOARD' && 'Visão Geral'}
                  {view === 'INVENTORY' && 'Controle de Estoque'}
                  {view === 'FORM' && (editingTransaction ? 'Editar Registro' : 'Registrar Movimentação')}
                  {view === 'HISTORY' && 'Histórico Completo'}
                  {view === 'SETTINGS' && 'Gerenciar Usuários'}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  {view === 'INVENTORY' ? 'Lista consolidada de itens e saldos.' :
                    view === 'SETTINGS' ? 'Adicione e gerencie usuários do sistema.' :
                      'Gerencie seu estoque de forma simples e eficiente.'}
                </p>
              </div>

              {view !== 'FORM' && view !== 'SETTINGS' && (
                <button
                  onClick={() => { setEditingTransaction(null); setPresetCode(undefined); setView('FORM'); }}
                  className="bg-primary-600 text-white px-5 py-2.5 rounded-lg font-semibold shadow-lg shadow-primary-500/30 hover:bg-primary-700 transition-all flex items-center gap-2 active:scale-95"
                >
                  <Plus size={18} /> Registrar
                </button>
              )}
            </div>

            {/* Views */}
            {view === 'DASHBOARD' && (
              <div className="animate-fade-in space-y-6">
                <StatsCards
                  stats={stats}
                  dateFilter={dateFilter}
                  onFilterChange={setDateFilter}
                  criticalItemsList={criticalItemsList}
                />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <Dashboard transactions={transactions} />
                  </div>
                  <div className="lg:col-span-1 h-96">
                    <div className="bg-primary-900 rounded-xl p-6 text-white h-full relative overflow-hidden flex flex-col justify-center items-center text-center">
                      <div className="absolute top-0 right-0 p-32 bg-primary-800 rounded-full blur-3xl -mr-16 -mt-16"></div>
                      <div className="absolute bottom-0 left-0 p-24 bg-emerald-500 rounded-full blur-3xl -ml-10 -mb-10 opacity-20"></div>

                      <div className="relative z-10">
                        <div className="bg-white/10 p-4 rounded-full inline-block mb-4 backdrop-blur-sm">
                          <Package size={32} className="text-emerald-300" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Ver Estoque</h3>
                        <p className="text-primary-100 text-sm mb-6 max-w-[200px] mx-auto">
                          Consulte a lista de itens, saldos atuais e movimente rapidamente.
                        </p>
                        <button
                          onClick={() => setView('INVENTORY')}
                          className="bg-white text-primary-900 px-6 py-3 rounded-lg font-bold hover:bg-emerald-50 transition-colors w-full"
                        >
                          Ir para Estoque
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'INVENTORY' && (
              <div className="flex-1 min-h-0">
                <InventoryList
                  transactions={transactions}
                  onSelectCode={handleSelectInventoryItem}
                  onImportInventory={handleInventoryImport}
                />
              </div>
            )}

            {view === 'FORM' && (
              <div className="max-w-2xl mx-auto w-full flex-1">
                <MovementForm
                  onAdd={handleAddTransaction}
                  onUpdate={handleUpdateTransaction}
                  onCancel={() => { setEditingTransaction(null); setPresetCode(undefined); setView('HISTORY'); }}
                  transactions={transactions}
                  initialData={editingTransaction}
                  presetCode={presetCode}
                />
              </div>
            )}

            {view === 'HISTORY' && (
              <div className="flex-1 min-h-0">
                <TransactionHistory
                  transactions={transactions}
                  onDelete={handleDelete}
                  onEdit={startEditing}
                />
              </div>
            )}

            {view === 'SETTINGS' && user.role === 'admin' && (
              <div className="flex-1 min-h-0">
                <UserManagement />
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;