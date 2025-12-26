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
export function calculateWeightedAvgSales(
  salesTrend?: number[], 
  months?: number
): number {
  if (!salesTrend || salesTrend.length === 0) {
    return 0;
  }
  
  // Si se especifica months, usar solo los últimos N meses
  const dataToUse = months 
    ? salesTrend.slice(-Math.min(months, salesTrend.length))
    : salesTrend;
  
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
  
  // Round to 1 decimal
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
  
  items.forEach(item => {
    if (isFinite(item.estimatedSaleTime)) {
      totalWeightedTime += item.estimatedSaleTime * item.quantity;
      totalQuantity += item.quantity;
    }
  });
  
  return totalQuantity > 0 ? totalWeightedTime / totalQuantity : 0;
}


