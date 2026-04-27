import {
  calculateEstimatedSaleTime,
  calculateWeightedAvgSales,
} from '@/lib/utils/salesCalculations';

export type ActiveRating = 'GREAT' | 'GOOD' | 'OK' | 'SLOW' | 'NO DATA';

export const RATING_CONFIG: Record<
  ActiveRating,
  { label: string; color: string; bg: string; border: string }
> = {
  GREAT: {
    label: 'Excelente',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  GOOD: {
    label: 'Bueno',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  OK: {
    label: 'Regular',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  SLOW: {
    label: 'Lento',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  'NO DATA': {
    label: 'Sin datos',
    color: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
  },
};

/**
 * Velocity-based rating from active sales trend.
 * Eje distinto al StockStatus (rotación) — mide velocidad de venta del stock actual.
 */
export function getArticleActiveRating(article: {
  stock: number;
  activeStockTrend?: number[];
}): ActiveRating {
  const trend = article.activeStockTrend;
  if (!trend || trend.length === 0) return 'NO DATA';
  const wma = calculateWeightedAvgSales(trend, trend.length);
  if (wma <= 0) return 'NO DATA';
  const est = calculateEstimatedSaleTime(article.stock, wma);
  if (!isFinite(est)) return 'NO DATA';
  if (est <= 12) return 'GREAT';
  if (est <= 24) return 'GOOD';
  if (est <= 60) return 'OK';
  return 'SLOW';
}
