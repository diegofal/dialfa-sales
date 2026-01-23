/**
 * Stock Movement Types
 * These constants define the types of stock movements in the system
 */

export const STOCK_MOVEMENT_TYPES = {
  CREDIT: 1, // Add to stock (returns, cancellations)
  DEBIT: 2, // Remove from stock (sales, invoices)
} as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[keyof typeof STOCK_MOVEMENT_TYPES];

export const STOCK_ADJUSTMENT_REASONS = {
  INVENTORY: 'Inventario físico',
  ERROR: 'Error de carga',
  DAMAGE: 'Rotura/Deterioro',
  SAMPLE: 'Muestra',
  OTHER: 'Otro',
} as const;
