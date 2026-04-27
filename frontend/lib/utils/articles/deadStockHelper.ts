import type { Article } from '@/types/article';
import { StockStatus } from '@/types/stockValuation';

const DEFAULT_DEAD_STOCK_THRESHOLD_DAYS = 365;

function daysSince(dateIso: string): number {
  const ms = Date.now() - new Date(dateIso).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

export function isDeadStock(
  article: Pick<Article, 'lastSaleDate'>,
  thresholdDays: number = DEFAULT_DEAD_STOCK_THRESHOLD_DAYS
): boolean {
  if (!article.lastSaleDate) return false;
  return daysSince(article.lastSaleDate) > thresholdDays;
}

export function isNeverSold(article: Pick<Article, 'lastSaleDate'>): boolean {
  return !article.lastSaleDate;
}

export function getStockStatus(article: Pick<Article, 'lastSaleDate'>): StockStatus {
  if (!article.lastSaleDate) return StockStatus.NEVER_SOLD;
  const days = daysSince(article.lastSaleDate);
  if (days > 365) return StockStatus.DEAD_STOCK;
  if (days > 180) return StockStatus.SLOW_MOVING;
  return StockStatus.ACTIVE;
}
