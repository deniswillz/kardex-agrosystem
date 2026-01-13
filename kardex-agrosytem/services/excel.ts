import { Transaction, MovementType } from '../types';

// Declare XLSX global from CDN
declare const XLSX: any;

export const downloadTemplate = () => {
  if (typeof XLSX === 'undefined') {
    alert("Erro: Biblioteca XLSX não carregada.");
    return;
  }
  const headers = [
    {
      'ID': 'DEIXE_EM_BRANCO_PARA_NOVO',
      'Data': '2023-10-25',
      'Código': 'SKU-001',
      'Item': 'Exemplo de Item',
      'Tipo': 'ENTRADA',
      'Quantidade': 100,
      'Armazém': 'Geral',
      'Endereço': 'A1',
      'Responsável': 'João'
    }
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(headers);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo Importação");
  XLSX.writeFile(workbook, "Modelo_Kardex.xlsx");
};

export const exportToExcel = (transactions: Transaction[]) => {
  if (typeof XLSX === 'undefined') {
    alert("Erro: Biblioteca XLSX não carregada. Verifique sua conexão com a internet.");
    return;
  }

  // Map data to strict columns that match our Import logic
  const dataToExport = transactions.map(t => ({
    'ID': t.id, 
    'Data': t.date, 
    'Código': t.code,
    'Item': t.name,
    'Tipo': t.type,
    'Quantidade': t.quantity,
    'Armazém': t.warehouse,
    'Endereço': t.address || '',
    'Responsável': t.responsible || '',
    'Carimbo de Data/Hora': new Date(t.timestamp).toLocaleString()
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  
  const wscols = [
    { wch: 36 }, // ID
    { wch: 12 }, // Data
    { wch: 15 }, // Código
    { wch: 30 }, // Item
    { wch: 10 }, // Tipo
    { wch: 12 }, // Quantidade
    { wch: 20 }, // Armazém
    { wch: 15 }, // Endereço
    { wch: 20 }, // Responsável
    { wch: 22 }  // Timestamp
  ];
  worksheet['!cols'] = wscols;

  XLSX.utils.book_append_sheet(workbook, worksheet, "Kardex Movimentações");
  XLSX.writeFile(workbook, `Kardex_Dados_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const importFromExcel = async (file: File): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        
        if (typeof XLSX === 'undefined') {
          reject(new Error("Biblioteca XLSX não carregada. Verifique sua conexão."));
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const transactions: Transaction[] = jsonData.map((row: any) => {
          // Flexible field mapping
          const code = row['Código'] || row['Codigo'] || row['Code'] || row['SKU'];
          const name = row['Item'] || row['Nome'] || row['Descrição'] || row['Description'] || row['Name'];
          const typeRaw = row['Tipo'] || row['Type'] || 'ENTRADA';
          const qty = row['Quantidade'] || row['Qtd'] || row['Quantity'] || row['Quant'] || 0;
          const warehouse = row['Armazém'] || row['Armazem'] || row['Warehouse'] || row['Local'] || 'Geral';
          const date = row['Data'] || row['Date'];
          const id = row['ID'];

          // Normalize Type
          let type: MovementType = 'ENTRADA';
          const t = String(typeRaw).toUpperCase();
          if (t.includes('SAI') || t.includes('OUT') || t.includes('EXIT') || t.includes('SAÍ')) {
            type = 'SAIDA';
          }

          // Handle Excel Date
          let dateStr = new Date().toISOString().split('T')[0];
          if (date) {
            if (typeof date === 'number' && date > 20000) {
               const dateObj = new Date((date - (25567 + 1)) * 86400 * 1000); 
               dateStr = dateObj.toISOString().split('T')[0];
            } else {
               const d = new Date(date);
               if (!isNaN(d.getTime())) {
                 dateStr = d.toISOString().split('T')[0];
               }
            }
          }

          // Skip example rows or invalid rows
          if (!code || !name || code === 'SKU-001') return null;

          return {
            id: (id && id !== 'DEIXE_EM_BRANCO_PARA_NOVO') ? id : crypto.randomUUID(),
            date: dateStr,
            code: String(code).toUpperCase(),
            name: String(name),
            type,
            quantity: Number(qty),
            warehouse: String(warehouse),
            address: row['Endereço'] || row['Endereco'] || row['Address'] || '',
            responsible: row['Responsável'] || row['Responsavel'] || row['Responsible'] || '',
            photos: [],
            timestamp: Date.now()
          };
        }).filter((t: any) => t !== null) as Transaction[];

        resolve(transactions);
      } catch (err) {
        console.error("Erro ao importar Excel:", err);
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};