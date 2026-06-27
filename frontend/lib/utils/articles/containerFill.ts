/**
 * Container fill planner — pure, deterministic logic for "armar contenedor".
 *
 * A container is weight-constrained (e.g. 25 t). Given the active catalog, a
 * coverage period and a strategy mode, this picks which articles to import and
 * how many units of each, until the remaining capacity (kg) is filled.
 *
 * Kept free of React/network so it can be unit-tested and reused.
 */
import { Article } from '@/types/article';
import { calculateWeightedAvgSales } from '../salesCalculations';
import { getArticleCifCost, getArticleDiscountedSellPrice } from './marginCalculations';

export type FillMode = 'money' | 'rotation' | 'critical';

export interface FillStrategy {
  mode: FillMode;
  /** Months of projected demand to bring (the fill "lever"). */
  coverageMonths: number;
  /** Drop articles that never sell (WMA = 0). */
  excludeNoRotation: boolean;
  /** Cap so stock + ordered never exceeds this many months of demand. 0 = no cap. */
  maxStockMonths: number;
  /**
   * Round each quantity to a "nice" increment scaled to its magnitude
   * (5/10/25/50/100...). Off by default — opt in once tuned.
   */
  roundQuantities?: boolean;
  /**
   * Cap how much of the container a single SKU may take, as a fraction of the
   * space available when it is added (0..1). undefined = no per-SKU cap.
   * Ignored when `maxSkus` is set (few-items orders are meant to concentrate).
   */
  maxShare?: number;
  /**
   * Max number of distinct articles (lines) to include. undefined / 0 = no limit.
   * When set, quantities concentrate into the top-ranked items.
   */
  maxSkus?: number;
  /** Only consider these category ids. undefined / empty = all categories. */
  categoryIds?: number[];
}

export interface ContainerFillEntry {
  article: Article;
  quantity: number;
}

export interface ContainerFillResult {
  entries: ContainerFillEntry[];
  addedKg: number;
}

interface ScoredCandidate {
  article: Article;
  weightPer: number;
  wma: number;
  /** Months of stock currently on hand (Infinity if it doesn't sell). */
  coverage: number;
  profitPerKg: number;
  demandQty: number;
  shortfallQty: number;
  headroom: number;
}

/**
 * Round a quantity up to a sensible increment for its magnitude, so orders read
 * cleanly (e.g. 187 -> 200, 53 -> 55, 7 -> 7). Never returns less than 1.
 */
export function roundQuantityNicely(qty: number): number {
  if (qty <= 10) return Math.max(1, Math.ceil(qty));
  let step: number;
  if (qty <= 50) step = 5;
  else if (qty <= 200) step = 10;
  else if (qty <= 1000) step = 25;
  else if (qty <= 5000) step = 100;
  else step = 500;
  return Math.ceil(qty / step) * step;
}

function score(
  articles: Article[],
  excludeIds: Set<number>,
  trendMonths: number,
  strategy: FillStrategy
): ScoredCandidate[] {
  const { coverageMonths, maxStockMonths } = strategy;
  const catSet =
    strategy.categoryIds && strategy.categoryIds.length ? new Set(strategy.categoryIds) : null;
  return articles
    .filter(
      (a) =>
        !excludeIds.has(a.id) && Number(a.weightKg) > 0 && (!catSet || catSet.has(a.categoryId))
    )
    .map((a) => {
      const weightPer = Number(a.weightKg);
      const stock = Number(a.stock);
      const wma = calculateWeightedAvgSales(a.salesTrend ?? [], trendMonths);
      const sell = getArticleDiscountedSellPrice(a);
      const cost = getArticleCifCost(a);
      const profitPerUnit = sell !== null && cost !== null ? sell - cost : null;
      const profitPerKg = profitPerUnit !== null ? profitPerUnit / weightPer : -Infinity;
      const coverage = wma > 0 ? stock / wma : Infinity;
      const demandQty = Math.ceil(wma * coverageMonths);
      const shortfallQty = Math.max(0, Math.ceil(wma * coverageMonths - stock));
      const headroom =
        maxStockMonths > 0 ? Math.max(0, Math.ceil(maxStockMonths * wma - stock)) : Infinity;
      return {
        article: a,
        weightPer,
        wma,
        coverage,
        profitPerKg,
        demandQty,
        shortfallQty,
        headroom,
      };
    });
}

/**
 * Build the list of articles + quantities to add to the container.
 *
 * @param articles    catalog to choose from (active, with trends loaded)
 * @param excludeIds  article ids already in the order (skipped)
 * @param remainingKg free kg in the container to fill
 * @param trendMonths historical window used to compute WMA
 * @param strategy    mode + coverage + filters
 */
export function buildContainerFill(
  articles: Article[],
  excludeIds: Set<number>,
  remainingKg: number,
  trendMonths: number,
  strategy: FillStrategy
): ContainerFillResult {
  if (remainingKg <= 0) return { entries: [], addedKg: 0 };

  const { mode, coverageMonths, excludeNoRotation } = strategy;
  const scored = score(articles, excludeIds, trendMonths, strategy);

  let candidates = scored.filter((c) => (excludeNoRotation ? c.wma > 0 : true));

  if (mode === 'money') {
    candidates = candidates
      .filter((c) => c.profitPerKg > 0)
      .sort((a, b) => b.profitPerKg - a.profitPerKg);
  } else if (mode === 'rotation') {
    candidates = candidates.filter((c) => c.wma > 0).sort((a, b) => b.wma - a.wma);
  } else {
    // critical: only items that won't cover the period, most urgent first
    candidates = candidates
      .filter((c) => c.wma > 0 && c.coverage < coverageMonths && c.shortfallQty >= 1)
      .sort((a, b) => a.coverage - b.coverage);
  }

  const maxSkus = strategy.maxSkus && strategy.maxSkus > 0 ? strategy.maxSkus : Infinity;
  // A per-SKU share cap fragments the order, so it only applies when there is no
  // explicit item limit (few-items orders are meant to concentrate).
  const applyShare =
    strategy.maxShare !== undefined && strategy.maxShare > 0 && !Number.isFinite(maxSkus);

  let remaining = remainingKg;
  const entries: ContainerFillEntry[] = [];
  for (const c of candidates) {
    if (remaining <= 0 || entries.length >= maxSkus) break;
    const target = mode === 'critical' ? c.shortfallQty : c.demandQty;
    let maxByWeight = Math.floor(remaining / c.weightPer);
    if (applyShare) {
      maxByWeight = Math.min(
        maxByWeight,
        Math.floor((remaining * strategy.maxShare!) / c.weightPer)
      );
    }
    let qty = Math.min(target, c.headroom, maxByWeight);
    if (strategy.roundQuantities && qty >= 1) {
      // Round nicely, but never exceed what fits by weight
      qty = Math.min(roundQuantityNicely(qty), Math.floor(remaining / c.weightPer));
    }
    if (qty < 1) continue; // nothing sensible fits — try the next item
    entries.push({ article: c.article, quantity: qty });
    remaining -= qty * c.weightPer;
  }

  return { entries, addedKg: remainingKg - remaining };
}
