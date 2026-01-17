// Warehouse list with descriptions
export const WAREHOUSES = [
    { code: '01', name: 'Chicote' },
    { code: '02', name: 'Entrada' },
    { code: '03', name: 'Importado' },
    { code: '04', name: 'Chicote' },
    { code: '04', name: 'Mecânica' },
    { code: '04', name: 'Eletrônica' },
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

// Check if operation affects stock (only Contagem doesn't affect)
export const operationAffectsStock = (categoryId: number | undefined): boolean => {
    // If no category_id or category_id is 1 (Movimentação), it affects stock
    // Only category_id === 2 (Contagem) doesn't affect stock
    return !categoryId || categoryId !== OPERATION_TYPES.CONTAGEM;
};
