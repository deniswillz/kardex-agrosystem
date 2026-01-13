// Tipos de operação - Movimentação altera estoque, Contagem apenas verifica
export const OPERATION_TYPES = [
    { id: 1, name: 'Movimentação', color: '#3b82f6', affectsStock: true },
    { id: 2, name: 'Contagem', color: '#8b5cf6', affectsStock: false },
];

export const getOperationTypeColor = (typeId: number | null | undefined): string => {
    if (!typeId) return '#6b7280';
    const type = OPERATION_TYPES.find(t => t.id === typeId);
    return type?.color || '#6b7280';
};

export const getOperationTypeName = (typeId: number | null | undefined): string => {
    if (!typeId) return 'Movimentação';
    const type = OPERATION_TYPES.find(t => t.id === typeId);
    return type?.name || 'Movimentação';
};

export const operationAffectsStock = (typeId: number | null | undefined): boolean => {
    if (!typeId) return true; // Default to affecting stock
    const type = OPERATION_TYPES.find(t => t.id === typeId);
    return type?.affectsStock ?? true;
};

// Legacy - keeping for compatibility
export const DEFAULT_CATEGORIES = OPERATION_TYPES;
export const getCategoryColor = getOperationTypeColor;
export const getCategoryName = getOperationTypeName;
