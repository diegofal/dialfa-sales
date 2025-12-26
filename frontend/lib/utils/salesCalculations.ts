/**
 * Calculate the average monthly sales from a sales trend array
 * MÉTODO 1: Promedio Simple (actual)
 */
export function calculateAvgMonthlySales(salesTrend?: number[]): number {
  if (!salesTrend || salesTrend.length === 0) {
    return 0;
  }
  
  const totalSales = salesTrend.reduce((sum, value) => sum + value, 0);
  return totalSales / salesTrend.length;
}

/**
 * MÉTODO 2: Promedio de últimos N meses
 */
export function calculateRecentAvgSales(
  salesTrend?: number[], 
  recentMonths: number = 6
): number {
  if (!salesTrend || salesTrend.length === 0) {
    return 0;
  }
  
  const recentData = salesTrend.slice(-Math.min(recentMonths, salesTrend.length));
  const totalSales = recentData.reduce((sum, value) => sum + value, 0);
  
  return totalSales / recentData.length;
}

/**
 * MÉTODO 3: Weighted Moving Average (WMA) - Más peso a meses recientes
 */
export function calculateWeightedAvgSales(salesTrend?: number[]): number {
  if (!salesTrend || salesTrend.length === 0) {
    return 0;
  }
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  salesTrend.forEach((value, index) => {
    const weight = index + 1; // Mes más antiguo peso 1, más reciente peso N
    weightedSum += value * weight;
    totalWeight += weight;
  });
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * MÉTODO 4: Exponential Moving Average (EMA)
 */
export function calculateEmaAvgSales(salesTrend?: number[], alpha: number = 0.3): number {
  if (!salesTrend || salesTrend.length === 0) {
    return 0;
  }
  
  let ema = salesTrend[0];
  for (let i = 1; i < salesTrend.length; i++) {
    ema = alpha * salesTrend[i] + (1 - alpha) * ema;
  }
  
  return ema;
}

/**
 * MÉTODO 5: Últimos N meses + WMA combinado
 */
export function calculateRecentWeightedAvgSales(
  salesTrend?: number[], 
  recentMonths: number = 6
): number {
  if (!salesTrend || salesTrend.length === 0) {
    return 0;
  }
  
  const recentData = salesTrend.slice(-Math.min(recentMonths, salesTrend.length));
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  recentData.forEach((value, index) => {
    const weight = index + 1;
    weightedSum += value * weight;
    totalWeight += weight;
  });
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * MÉTODO 6: Mediana (resistente a outliers)
 */
export function calculateMedianSales(salesTrend?: number[]): number {
  if (!salesTrend || salesTrend.length === 0) {
    return 0;
  }
  
  const sorted = [...salesTrend].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
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


