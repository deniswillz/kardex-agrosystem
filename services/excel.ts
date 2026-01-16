import { Transaction, MovementType } from '../types';

// Declare XLSX global from CDN
declare const XLSX: any;

export interface InventoryImportItem {
  code: string;
  name: string;
  quantity: number;
  warehouse: string;
  address?: string;
  min_stock?: number;
}

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
          console.error("XLSX library not loaded");
          reject(new Error("Biblioteca XLSX não carregada. Verifique sua conexão."));
          return;
        }

        console.log("📊 Iniciando leitura do arquivo Excel...");
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        console.log("📋 Sheet encontrada:", firstSheetName);

        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log("📝 Linhas encontradas no Excel:", jsonData.length);

        if (jsonData.length > 0) {
          console.log("🔍 Primeira linha (headers detectados):", Object.keys(jsonData[0]));
          console.log("🔍 Dados da primeira linha:", jsonData[0]);
        }

        let skippedRows = 0;
        let processedRows = 0;

        const transactions: Transaction[] = jsonData.map((row: any, index: number) => {
          // Flexible field mapping - check multiple possible column names
          const code = row['Código'] || row['Codigo'] || row['Code'] || row['SKU'] || row['CÓDIGO'] || row['CODIGO'];
          const name = row['Item'] || row['Nome'] || row['Descrição'] || row['Description'] || row['Name'] || row['ITEM'] || row['NOME'];
          const typeRaw = row['Tipo'] || row['Type'] || row['TIPO'] || 'ENTRADA';
          const qty = row['Quantidade'] || row['Qtd'] || row['Quantity'] || row['Quant'] || row['QUANTIDADE'] || row['QTD'] || 0;
          const warehouse = row['Armazém'] || row['Armazem'] || row['Warehouse'] || row['Local'] || row['ARMAZÉM'] || row['ARMAZEM'] || 'Geral';
          const date = row['Data'] || row['Date'] || row['DATA'];
          const id = row['ID'] || row['Id'] || row['id'];

          // Debug log for first few rows
          if (index < 3) {
            console.log(`📦 Linha ${index + 1}:`, { code, name, typeRaw, qty, warehouse, date, id });
          }

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
              // Excel serial date
              const dateObj = new Date((date - (25567 + 1)) * 86400 * 1000);
              dateStr = dateObj.toISOString().split('T')[0];
            } else if (typeof date === 'string') {
              // Try to parse string date
              const d = new Date(date);
              if (!isNaN(d.getTime())) {
                dateStr = d.toISOString().split('T')[0];
              }
            }
          }

          // Skip invalid rows (must have code AND name)
          if (!code || !name) {
            console.log(`⚠️ Linha ${index + 1} ignorada: código ou item vazio`, { code, name });
            skippedRows++;
            return null;
          }

          // Skip template example row
          if (String(code).toUpperCase() === 'SKU-001') {
            console.log(`⚠️ Linha ${index + 1} ignorada: linha de exemplo (SKU-001)`);
            skippedRows++;
            return null;
          }

          processedRows++;

          return {
            id: (id && id !== 'DEIXE_EM_BRANCO_PARA_NOVO' && id !== '') ? String(id) : crypto.randomUUID(),
            date: dateStr,
            code: String(code).toUpperCase().trim(),
            name: String(name).trim(),
            type,
            quantity: Math.abs(Number(qty)) || 0,
            warehouse: String(warehouse).trim() || 'Geral',
            address: String(row['Endereço'] || row['Endereco'] || row['Address'] || row['ENDEREÇO'] || '').trim(),
            responsible: String(row['Responsável'] || row['Responsavel'] || row['Responsible'] || row['RESPONSÁVEL'] || '').trim(),
            photos: [],
            timestamp: Date.now()
          };
        }).filter((t: any) => t !== null) as Transaction[];

        console.log(`✅ Importação concluída: ${processedRows} registros processados, ${skippedRows} linhas ignoradas`);

        resolve(transactions);
      } catch (err) {
        console.error("❌ Erro ao importar Excel:", err);
        reject(err);
      }
    };

    reader.onerror = (err) => {
      console.error("❌ Erro ao ler arquivo:", err);
      reject(err);
    };
    reader.readAsArrayBuffer(file);
  });
};

// Download template for inventory import
export const downloadInventoryTemplate = () => {
  if (typeof XLSX === 'undefined') {
    alert("Erro: Biblioteca XLSX não carregada.");
    return;
  }

  const exampleData = [
    {
      'Código': 'PROD-001',
      'Item': 'Produto Exemplo 1',
      'Quantidade': 100,
      'Armazém': 'Geral',
      'Endereço': 'A1-01',
      'Estoque Mínimo': 10
    },
    {
      'Código': 'PROD-002',
      'Item': 'Produto Exemplo 2',
      'Quantidade': 50,
      'Armazém': 'Secundário',
      'Endereço': 'B2-05',
      'Estoque Mínimo': 5
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(exampleData);
  const workbook = XLSX.utils.book_new();

  // Column widths
  worksheet['!cols'] = [
    { wch: 15 }, // Código
    { wch: 30 }, // Item
    { wch: 12 }, // Quantidade
    { wch: 15 }, // Armazém
    { wch: 12 }, // Endereço
    { wch: 15 }  // Estoque Mínimo
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Lista de Estoque");
  XLSX.writeFile(workbook, "Modelo_Lista_Estoque.xlsx");
};

// Import inventory items from Excel
export const importInventoryFromExcel = async (file: File): Promise<InventoryImportItem[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;

        if (typeof XLSX === 'undefined') {
          console.error("XLSX library not loaded");
          reject(new Error("Biblioteca XLSX não carregada."));
          return;
        }

        console.log("📊 Iniciando importação de lista de estoque...");
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        console.log("📋 Sheet encontrada:", firstSheetName);

        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log("📝 Linhas encontradas:", jsonData.length);

        if (jsonData.length > 0) {
          console.log("🔍 Colunas detectadas:", Object.keys(jsonData[0]));
        }

        let skippedRows = 0;
        let processedRows = 0;

        const items: InventoryImportItem[] = jsonData.map((row: any, index: number) => {
          // Flexible field mapping
          const code = row['Código'] || row['Codigo'] || row['Code'] || row['SKU'] || row['CÓDIGO'] || row['CODIGO'];
          const name = row['Item'] || row['Nome'] || row['Descrição'] || row['Description'] || row['Name'] || row['ITEM'] || row['NOME'] || row['Produto'] || row['PRODUTO'];
          const qty = row['Quantidade'] || row['Qtd'] || row['Quantity'] || row['Quant'] || row['QUANTIDADE'] || row['QTD'] || row['Saldo'] || row['SALDO'] || 0;
          const warehouse = row['Armazém'] || row['Armazem'] || row['Warehouse'] || row['Local'] || row['ARMAZÉM'] || row['ARMAZEM'] || 'Geral';
          const address = row['Endereço'] || row['Endereco'] || row['Address'] || row['ENDEREÇO'] || row['Localização'] || '';
          const minStock = row['Estoque Mínimo'] || row['Estoque Minimo'] || row['Min Stock'] || row['Min'] || row['ESTOQUE MÍNIMO'] || row['Mínimo'] || 0;

          // Debug log for first few rows
          if (index < 3) {
            console.log(`📦 Linha ${index + 1}:`, { code, name, qty, warehouse, address, minStock });
          }

          // Skip invalid rows (must have code AND name)
          if (!code || !name) {
            console.log(`⚠️ Linha ${index + 1} ignorada: código ou item vazio`, { code, name });
            skippedRows++;
            return null;
          }

          // Skip example rows
          if (String(code).toUpperCase().startsWith('PROD-00')) {
            console.log(`⚠️ Linha ${index + 1} ignorada: linha de exemplo`);
            skippedRows++;
            return null;
          }

          processedRows++;

          return {
            code: String(code).toUpperCase().trim(),
            name: String(name).trim(),
            quantity: Math.round(Math.abs(Number(qty))) || 0,
            warehouse: String(warehouse).trim() || 'Geral',
            address: String(address).trim() || undefined,
            min_stock: Math.abs(Number(minStock)) || undefined
          };
        }).filter((item): item is InventoryImportItem => item !== null);

        console.log(`✅ Importação concluída: ${processedRows} itens processados, ${skippedRows} linhas ignoradas`);

        resolve(items);
      } catch (err) {
        console.error("❌ Erro ao importar Excel:", err);
        reject(err);
      }
    };

    reader.onerror = (err) => {
      console.error("❌ Erro ao ler arquivo:", err);
      reject(err);
    };
    reader.readAsArrayBuffer(file);
  });
};