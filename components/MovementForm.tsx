import React, { useState, useRef, useEffect } from 'react';
import { Camera, QrCode, X, Save, ArrowLeft, Tag, AlertTriangle, ClipboardList, Loader2 } from 'lucide-react';
import { Transaction, MovementType } from '../types';
import { OPERATION_TYPES, operationAffectsStock } from '../constants/categories';
import { compressImage } from '../services/imageUtils';
import { useAuth } from './AuthContext';

interface MovementFormProps {
  onAdd: (transaction: Omit<Transaction, 'id' | 'timestamp'>) => void;
  onUpdate?: (id: string, transaction: Omit<Transaction, 'id' | 'timestamp'>) => void;
  onCancel?: () => void;
  transactions: Transaction[];
  initialData?: Transaction | null;
  presetCode?: string;
}

export const MovementForm: React.FC<MovementFormProps> = ({
  onAdd,
  onUpdate,
  onCancel,
  transactions,
  initialData,
  presetCode
}) => {
  const { user } = useAuth();

  const [type, setType] = useState<MovementType>('ENTRADA');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [warehouse, setWarehouse] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentStock, setCurrentStock] = useState<number | null>(null);

  // Changed: categoryId now represents operation type (1=Movimentação, 2=Contagem)
  const [categoryId, setCategoryId] = useState<number>(1);
  const [minStock, setMinStock] = useState<number | ''>('');
  const [isUploading, setIsUploading] = useState(false);

  // QR Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
  }, []);

  // Initialize form if editing
  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setCode(initialData.code);
      setName(initialData.name);
      setQuantity(initialData.quantity);
      setWarehouse(initialData.warehouse);
      setAddress(initialData.address || '');
      setDate(initialData.date);
      setPhotos(initialData.photos || []);
      setCategoryId(initialData.category_id || 1);
      setMinStock(initialData.min_stock || '');
    }
  }, [initialData]);

  // Pre-fill code from inventory selection
  useEffect(() => {
    if (presetCode && !initialData) {
      setCode(presetCode);
    }
  }, [presetCode, initialData]);

  // Auto-fill logic based on code
  useEffect(() => {
    if (code) {
      // Calculate current stock for feedback (only from Movimentação type)
      const history = transactions.filter(t => t.code === code && operationAffectsStock(t.category_id));
      const totalEnt = history.filter(t => t.type === 'ENTRADA').reduce((acc, curr) => acc + curr.quantity, 0);
      const totalSai = history.filter(t => t.type === 'SAIDA').reduce((acc, curr) => acc + curr.quantity, 0);

      let adjust = 0;
      if (initialData && initialData.code === code && operationAffectsStock(initialData.category_id)) {
        adjust = initialData.type === 'ENTRADA' ? -initialData.quantity : initialData.quantity;
      }

      setCurrentStock((totalEnt - totalSai) + adjust);

      // Auto-fill name, warehouse if known and not editing
      if (!initialData) {
        const knownItem = transactions.find(t => t.code === code);
        if (knownItem) {
          if (!name) setName(knownItem.name);
          if (!warehouse) setWarehouse(knownItem.warehouse);
          if (!address && knownItem.address) setAddress(knownItem.address);
        }
      }
    } else {
      setCurrentStock(null);
    }
  }, [code, transactions, initialData]);

  // QR Scanner functions
  const startQRScanner = async () => {
    setIsScanning(true);
    setScanStatus('scanning');

    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          // Start continuous scanning
          scanQRCode();
        }
      } catch (error) {
        console.error('Camera access error:', error);
        alert('Não foi possível acessar a câmera. Verifique as permissões do navegador.');
        setIsScanning(false);
        setScanStatus('idle');
      }
    }, 100);
  };

  const stopQRScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setScanStatus('idle');
  };

  // Real QR Code scanning using jsQR
  const scanQRCode = async () => {
    // Load jsQR library dynamically
    const loadJsQR = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if ((window as any).jsQR) {
          resolve((window as any).jsQR);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
        script.async = true;
        script.onload = () => resolve((window as any).jsQR);
        script.onerror = () => reject(new Error('Failed to load jsQR library'));
        document.head.appendChild(script);
      });
    };

    try {
      const jsQR = await loadJsQR();

      const scan = () => {
        if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
          requestAnimationFrame(scan);
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (qrCode && qrCode.data) {
          setScanStatus('found');
          setCode(qrCode.data.toUpperCase());
          // Small delay to show success before closing
          setTimeout(() => {
            stopQRScanner();
          }, 500);
          return;
        }

        requestAnimationFrame(scan);
      };

      scan();
    } catch (error) {
      console.error('Error loading jsQR:', error);
      alert('Erro ao carregar biblioteca de QR Code. Verifique sua conexão.');
      stopQRScanner();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || !quantity || !warehouse) return;

    const isContagem = categoryId === 2;

    // Validate exit quantity against current stock
    if (!isContagem && type === 'SAIDA' && currentStock !== null) {
      const exitQty = Number(quantity);
      const availableStock = initialData && initialData.type === 'SAIDA'
        ? currentStock + initialData.quantity
        : currentStock;

      if (exitQty > availableStock) {
        alert(`ATENÇÃO: Saldo insuficiente!\n\nSaldo atual: ${availableStock} un\nQuantidade solicitada: ${exitQty} un\n\nA movimentação não pode ser realizada.`);
        return;
      }
    }

    const formData: Omit<Transaction, 'id' | 'timestamp'> = {
      date,
      code: code.toUpperCase(),
      name,
      type: isContagem ? 'ENTRADA' : type, // Contagem always uses ENTRADA but doesn't affect stock
      quantity: Number(quantity),
      warehouse,
      address,
      responsible: user?.name || '', // Always use logged user, not editable
      photos,
      category_id: categoryId,
      min_stock: minStock ? Number(minStock) : undefined
    };

    if (initialData && onUpdate) {
      onUpdate(initialData.id, formData);
    } else {
      onAdd(formData);
    }

    // Reset if adding new
    if (!initialData) {
      setQuantity('');
      setCode('');
      setPhotos([]);
      setCurrentStock(null);
      setName('');
      setMinStock('');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      try {
        const compressed = await compressImage(e.target.files[0], 800, 0.7);
        if (photos.length < 3) {
          setPhotos([...photos, compressed]);
        }
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Erro ao processar imagem');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const isContagem = categoryId === 2;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-primary-100 overflow-hidden h-full flex flex-col">
      {/* QR Scanner Modal */}
      {isScanning && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="p-4 flex justify-between items-center bg-black/80 z-10">
            <span className="text-white font-bold">Escaneie o QR Code</span>
            <button onClick={stopQRScanner} className="text-white p-2">
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
            />
            {/* QR Frame Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Dark overlay around the frame */}
              <div className="absolute inset-0 bg-black/50"></div>

              {/* QR Frame container */}
              <div className="relative w-64 h-64">
                {/* Clear window in the middle */}
                <div className="absolute inset-0 bg-transparent border-[3px] border-white rounded-2xl shadow-2xl" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}></div>

                {/* Corner decorations */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-primary-400 rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-primary-400 rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-primary-400 rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-primary-400 rounded-br-xl"></div>

                {/* Scanning line animation */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-primary-400 to-transparent animate-pulse" style={{ animation: 'scan 2s ease-in-out infinite', top: '50%' }}></div>

                {/* QR Icon in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <QrCode size={48} className="text-white/30" />
                </div>
              </div>
            </div>

            {/* Hidden canvas for QR processing */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Instructions */}
            <div className="absolute bottom-24 left-0 right-0 text-center">
              <p className={`text-sm mx-auto inline-block px-4 py-2 rounded-full transition-all ${scanStatus === 'found'
                ? 'bg-green-500 text-white'
                : 'bg-black/50 text-white'
                }`}>
                {scanStatus === 'found'
                  ? '✓ QR Code detectado!'
                  : 'Posicione o QR Code dentro do quadro'}
              </p>
            </div>
          </div>
          <div className="p-4 bg-black/80 z-10">
            <p className="text-white/70 text-xs text-center mb-2">
              {scanStatus === 'scanning' ? 'Procurando QR Code...' : 'Aguardando câmera...'}
            </p>
            <button
              onClick={stopQRScanner}
              className="w-full py-3 bg-red-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
            >
              <X size={20} />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`p-4 ${isContagem ? 'bg-purple-600' : (type === 'ENTRADA' ? 'bg-primary-600' : 'bg-red-600')} text-white transition-colors duration-300 flex justify-between items-center`}>
        <div className="flex items-center gap-2">
          {initialData && onCancel && (
            <button onClick={onCancel} className="p-1 hover:bg-white/20 rounded-full mr-2">
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 className="font-bold text-lg flex items-center gap-2">
            {isContagem ? (
              <><ClipboardList size={20} /> Contagem de Estoque</>
            ) : (
              initialData ? 'Editar Movimento' : (type === 'ENTRADA' ? 'Nova Entrada' : 'Nova Saída')
            )}
          </h2>
        </div>

        {!isContagem && (
          <div className="flex bg-black/20 rounded-lg p-1">
            <button
              onClick={() => setType('ENTRADA')}
              className={`px-3 py-1 rounded-md text-sm font-semibold transition-all ${type === 'ENTRADA' ? 'bg-white text-primary-600 shadow-sm' : 'text-white/70 hover:text-white'}`}
            >
              Entrada
            </button>
            <button
              onClick={() => setType('SAIDA')}
              className={`px-3 py-1 rounded-md text-sm font-semibold transition-all ${type === 'SAIDA' ? 'bg-white text-red-600 shadow-sm' : 'text-white/70 hover:text-white'}`}
            >
              Saída
            </button>
          </div>
        )}
      </div>

      <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Operation Type (Movimentação / Contagem) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
              <Tag size={12} /> Tipo de Operação *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {OPERATION_TYPES.map(op => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setCategoryId(op.id)}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${categoryId === op.id
                    ? op.id === 1
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                >
                  <span className="font-semibold">{op.name}</span>
                  <p className="text-[10px] mt-0.5 opacity-70">
                    {op.affectsStock ? 'Altera estoque' : 'Apenas verificação'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Contagem info banner */}
          {isContagem && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 text-sm flex items-start gap-2">
              <ClipboardList size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>Contagem de Estoque</strong>
                <p className="text-xs mt-1 opacity-80">
                  Este registro serve para verificar se a quantidade física confere com o sistema.
                  Não altera o saldo do estoque.
                </p>
              </div>
            </div>
          )}

          {/* Code & Scan */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Código do Item *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5"
                placeholder="Digite ou escaneie o código"
                required
              />
              {/* Camera Scan Button */}
              <button
                type="button"
                onClick={startQRScanner}
                className="bg-slate-800 text-white p-2.5 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-1"
                title="Ler QR Code"
              >
                <Camera size={20} />
              </button>
            </div>
            {currentStock !== null && (
              <div className="mt-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                Estoque Atual: {currentStock} un
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição do Item *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5"
              placeholder="Ex: Parafuso Sextavado M8"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                {isContagem ? 'Quantidade Contada *' : 'Quantidade *'}
              </label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5"
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                {isContagem ? 'Local da Contagem *' : (type === 'ENTRADA' ? 'Origem *' : 'Destino *')}
              </label>
              <input
                type="text"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5"
                placeholder={isContagem ? 'Almoxarifado A' : (type === 'ENTRADA' ? 'Fornecedor / Fábrica' : 'Linha A / Cliente')}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Endereço</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5"
                placeholder="Rua 3, Prateleira B"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Responsible - LOCKED */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Responsável</label>
              <input
                type="text"
                value={user?.name || ''}
                className="bg-slate-100 border border-slate-200 text-slate-600 text-sm rounded-lg block w-full p-2.5 cursor-not-allowed"
                disabled
                readOnly
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Preenchido automaticamente</p>
            </div>
            {/* Min Stock */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <AlertTriangle size={12} /> Estoque Mínimo
              </label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value ? Number(e.target.value) : '')}
                className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5"
                placeholder="0"
              />
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fotos (Máx 3)</label>
            <div className="flex gap-2">
              {photos.map((p, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-300 group">
                  <img src={p} alt="preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-primary-500 hover:text-primary-500 transition-colors ${isUploading ? 'opacity-50' : ''}`}
                >
                  {isUploading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <>
                      <Camera size={20} />
                      <span className="text-[9px] mt-1">Adicionar</span>
                    </>
                  )}
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
              />
            </div>
          </div>

        </form>
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <button
          onClick={handleSubmit}
          className={`w-full py-3.5 px-4 rounded-xl text-white font-bold shadow-md transform active:scale-95 transition-all flex items-center justify-center gap-2 ${isContagem
            ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:shadow-purple-500/30'
            : type === 'ENTRADA'
              ? 'bg-gradient-to-r from-primary-600 to-primary-500 hover:shadow-primary-500/30'
              : 'bg-gradient-to-r from-red-600 to-red-500 hover:shadow-red-500/30'
            }`}
        >
          {initialData ? <Save size={20} /> : null}
          {initialData
            ? 'SALVAR ALTERAÇÕES'
            : isContagem
              ? 'REGISTRAR CONTAGEM'
              : `CONFIRMAR ${type}`
          }
        </button>
      </div>
    </div>
  );
};