// ============================================================================
// FINANCIAL CALCULATIONS
// ============================================================================

/**
 * Applies a discount percentage to a price.
 * @param price - Base price
 * @param discountPercent - Discount percentage (0-100)
 * @returns Price after discount
 */
export function calculateDiscountedPrice(price: number, discountPercent: number): number {
  return price * (1 - discountPercent / 100);
}

/**
 * Calculates the line total for an order/invoice item.
 * @param quantity - Number of units
 * @param unitPrice - Price per unit
 * @param discountPercent - Discount percentage (0-100), defaults to 0
 * @returns Total for the line (quantity * discounted price)
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercent: number = 0
): number {
  return quantity * calculateDiscountedPrice(unitPrice, discountPercent);
}

/**
 * Calculates subtotal from an array of items with quantity, unitPrice, and discount.
 */
export function calculateSubtotal(
  items: Array<{ quantity: number; unitPrice: number; discountPercent: number }>
): number {
  return items.reduce(
    (sum, item) => sum + calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent),
    0
  );
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Calculates the direction of a trend by comparing first and second half averages.
 * Used by stock valuation, client classification, and sales analysis.
 *
 * @param trend - Array of values over time (oldest to newest)
 * @param threshold - Percent change threshold to be considered non-stable (default 20)
 * @returns Trend direction
 */
export function calculateTrendDirection(
  trend: number[],
  threshold: number = 20
): 'increasing' | 'stable' | 'decreasing' | 'none' {
  if (!trend || trend.length < 2) return 'none';

  const midPoint = Math.floor(trend.length / 2);
  const firstHalf = trend.slice(0, midPoint);
  const secondHalf = trend.slice(midPoint);

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (avgFirst === 0 && avgSecond === 0) return 'none';
  if (avgFirst === 0) return 'increasing';

  const changePercent = ((avgSecond - avgFirst) / avgFirst) * 100;

  if (changePercent > threshold) return 'increasing';
  if (changePercent < -threshold) return 'decreasing';
  return 'stable';
}

// ============================================================================
// SALES FORECASTING
// ============================================================================

/**
 * Weighted Moving Average (WMA) - Más peso a meses recientes
 * Esta es la métrica recomendada basada en análisis estadístico.
 *
 * @param salesTrend - Array de ventas mensuales (del más antiguo al más reciente)
 * @param months - Número de meses a considerar (por defecto usa todo el array)
 * @returns Promedio ponderado de ventas mensuales
 *
 * Ejemplo: Para [10, 20, 30] con pesos [1, 2, 3]:
 *   WMA = (10*1 + 20*2 + 30*3) / (1+2+3) = 130/6 = 21.67
 */
export function calculateWeightedAvgSales(salesTrend?: number[], months?: number): number {
  if (!salesTrend || salesTrend.length === 0) {
    return 0;
  }

  // Si se especifica months, usar solo los últimos N meses
  const dataToUse = months ? salesTrend.slice(-Math.min(months, salesTrend.length)) : salesTrend;

  let weightedSum = 0;
  let totalWeight = 0;

  dataToUse.forEach((value, index) => {
    const weight = index + 1; // Mes más antiguo peso 1, más reciente peso N
    weightedSum += value * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculate estimated time to sell a given quantity based on average monthly sales
 * @returns Time in months, or Infinity if avgSales is 0
 */
export function calculateEstimatedSaleTime(quantity: number, avgSales: number): number {
  if (avgSales === 0) {
    return Infinity;
  }

  return quantity / avgSales;
}

/**
 * Format sale time in months to a human-readable string
 */
export function formatSaleTime(months: number): string {
  if (!isFinite(months) || months === 0) {
    return '∞ Infinito';
  }

  if (months < 1) {
    const days = Math.round(months * 30);
    return `~${days} días`;
  }

  if (months < 2) {
    return '~1 mes';
  }

  // Si es >= 12 meses, mostrar también en años
  if (months >= 12) {
    const years = months / 12;
    return `~${months.toFixed(1)} meses (${years.toFixed(1)} años)`;
  }

  // Menos de 12 meses, solo mostrar meses
  return `~${months.toFixed(1)} meses`;
}

/**
 * Calculate weighted average sale time for multiple items
 * Weights are based on quantity
 */
export function calculateWeightedAvgSaleTime(
  items: Array<{ quantity: number; estimatedSaleTime: number }>
): number {
  let totalWeightedTime = 0;
  let totalQuantity = 0;

  items.forEach((item) => {
    if (isFinite(item.estimatedSaleTime)) {
      totalWeightedTime += item.estimatedSaleTime * item.quantity;
      totalQuantity += item.quantity;
    }
  });

  return totalQuantity > 0 ? totalWeightedTime / totalQuantity : 0;
}
