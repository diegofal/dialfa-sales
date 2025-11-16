/**
 * Stock Movement Types
 * These constants define the types of stock movements in the system
 */

export const STOCK_MOVEMENT_TYPES = {
  CREDIT: 1,  // Add to stock (returns, cancellations)
  DEBIT: 2,   // Remove from stock (sales, invoices)
} as const;

export type StockMovementType = typeof STOCK_MOVEMENT_TYPES[keyof typeof STOCK_MOVEMENT_TYPES];








