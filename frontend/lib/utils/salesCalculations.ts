/**
 * Calculate the average monthly sales from a sales trend array
 */
export function calculateAvgMonthlySales(salesTrend?: number[]): number {
  if (!salesTrend || salesTrend.length === 0) {
    return 0;
  }
  
  const totalSales = salesTrend.reduce((sum, value) => sum + value, 0);
  return totalSales / salesTrend.length;
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


