/**
 * Margin = (unitPrice - costPrice) / costPrice * 100
 * Returns null when costPrice is missing or zero.
 */
export function calculateMarginPercent(
  unitPrice: number | null | undefined,
  costPrice: number | null | undefined
): number | null {
  if (unitPrice === null || unitPrice === undefined) return null;
  if (costPrice === null || costPrice === undefined || costPrice <= 0) return null;
  return ((unitPrice - costPrice) / costPrice) * 100;
}

export function formatMarginPercent(margin: number | null): string {
  if (margin === null) return '—';
  const sign = margin > 0 ? '+' : '';
  return `${sign}${margin.toFixed(1)}%`;
}

export function getMarginColorClass(margin: number | null): string {
  if (margin === null) return 'text-muted-foreground';
  if (margin >= 20) return 'text-emerald-600 dark:text-emerald-400';
  if (margin >= 5) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}
