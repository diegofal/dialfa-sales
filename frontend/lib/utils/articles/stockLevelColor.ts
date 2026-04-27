/**
 * Visual color class for the *quantity* of stock — independent from the canonical
 * StockStatus (rotation-based). Used in dropdowns/lists where the user wants to see
 * at a glance how much stock is on hand.
 *
 * For the canonical rotation status (ACTIVE / SLOW_MOVING / DEAD_STOCK / NEVER_SOLD)
 * use <StockStatusBadge /> with `article.stockStatus`.
 */
export function getStockLevelColorClass(stock: number): string {
  if (stock === 0) return 'text-red-600 font-semibold';
  if (stock < 10) return 'text-orange-600 font-semibold';
  return 'text-green-600';
}
