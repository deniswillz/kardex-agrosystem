// Warehouse list with descriptions
export const WAREHOUSES = [
    { code: '01', name: 'Chicote' },
    { code: '02', name: 'Entrada' },
    { code: '03', name: 'Importado' },
    { code: '04', name: 'Chicote / Mecânica / Eletrônica' },
    { code: '08', name: 'P&D' },
    { code: '11', name: 'Filial' },
    { code: '19', name: 'Qualidade' },
    { code: '20', name: 'Eletrônica' },
    { code: '21', name: 'Assistência' },
    { code: '22', name: 'Mecânica' },
];

// Warehouses allowed in inventory views (filtering)
export const ALLOWED_WAREHOUSES = ['01', '20', '22'];

// Operation types (for lookups)
export const OPERATION_TYPES = {
    MOVIMENTACAO: 1,
    CONTAGEM: 2,
} as const;

// Operation types list for UI iteration
export const OPERATION_TYPES_LIST = [
    { id: 1, name: 'Movimentação', affectsStock: true },
    { id: 2, name: 'Contagem', affectsStock: false },
];

// Check if operation affects stock (only Movimentação affects)
export const operationAffectsStock = (categoryId: number): boolean => {
    return categoryId === OPERATION_TYPES.MOVIMENTACAO;
};
