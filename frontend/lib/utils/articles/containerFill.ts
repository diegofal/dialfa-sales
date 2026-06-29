/**
 * Container fill planner — pure, deterministic logic for "armar contenedor".
 *
 * A container is weight-constrained (e.g. 25 t). Given the active catalog and a
 * coverage period, this picks which articles to import and how many units of
 * each until the remaining capacity (kg) is filled.
 *
 * There is a single ranking criterion: total profit contribution per line
 * (`WMA × unit margin`). This concentrates the order on the items that actually
 * make the most money over the period — codos/bridas/espárragos — instead of the
 * long tail of light, high-margin-per-kg fittings that barely sell.
 *
 * Kept free of React/network so it can be unit-tested and reused.
 */
import { Article } from '@/types/article';
import { calculateWeightedAvgSales } from '../salesCalculations';
import { getArticleCifCost, getArticleDiscountedSellPrice } from './marginCalculations';

/**
 * Count how many of the last `windowMonths` entries of a sales trend had sales.
 * Local (pure) copy of the helper in salesTrends.ts so this browser module stays
 * free of the prisma import that file carries.
 */
function monthsWithSales(trend: number[] | undefined, windowMonths: number): number {
  if (!trend || trend.length === 0 || windowMonths <= 0) return 0;
  const slice = windowMonths >= trend.length ? trend : trend.slice(-windowMonths);
  return slice.filter((q) => q > 0).length;
}

export interface FillStrategy {
  /** Months of projected demand to bring (the fill "lever"). */
  coverageMonths: number;
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
  /**
   * Exclude articles whose `importOrigin` is one of these (e.g. ['india'] under
   * anti-dumping). Articles available from a non-blocked origin ('china', 'both')
   * or of unknown origin (null) are kept. undefined / empty = no origin filter.
   */
  blockedOrigins?: string[];
  /**
   * "Papa caliente" recurrence floor: require sales in at least this many of the
   * last 12 months (uses the loaded salesTrend). 0 / undefined = no requirement.
   * Filters out one-shots that a single big sale would otherwise rank high.
   */
  minMonthsWithSales?: number;
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
  /** Total profit the line makes per month: WMA × unit margin. The ranking key. */
  profitTotal: number;
  demandQty: number;
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
  const blockedSet =
    strategy.blockedOrigins && strategy.blockedOrigins.length
      ? new Set(strategy.blockedOrigins)
      : null;
  const minMonths = strategy.minMonthsWithSales ?? 0;
  return articles
    .filter(
      (a) =>
        !excludeIds.has(a.id) &&
        Number(a.weightKg) > 0 &&
        (!catSet || catSet.has(a.categoryId)) &&
        // Sourcing: drop articles only available from a blocked origin. 'china',
        // 'both' and unknown (null) pass; an exactly-'india' article is dropped.
        (!blockedSet || !a.importOrigin || !blockedSet.has(a.importOrigin)) &&
        // Papa caliente: require recurrent sales (months with sales in last 12).
        (minMonths <= 0 || monthsWithSales(a.salesTrend, 12) >= minMonths)
    )
    .map((a) => {
      const weightPer = Number(a.weightKg);
      const stock = Number(a.stock);
      const wma = calculateWeightedAvgSales(a.salesTrend ?? [], trendMonths);
      const sell = getArticleDiscountedSellPrice(a);
      const cost = getArticleCifCost(a);
      const profitPerUnit = sell !== null && cost !== null ? sell - cost : 0;
      // Rank by total profit the line generates (WMA × unit margin), so the order
      // concentrates on the real money-makers, not the light high-margin-per-kg tail.
      const profitTotal = wma * profitPerUnit;
      const demandQty = Math.ceil(wma * coverageMonths);
      const headroom =
        maxStockMonths > 0 ? Math.max(0, Math.ceil(maxStockMonths * wma - stock)) : Infinity;
      return { article: a, weightPer, wma, profitTotal, demandQty, headroom };
    });
}

/**
 * Build the list of articles + quantities to add to the container.
 *
 * @param articles    catalog to choose from (active, with trends loaded)
 * @param excludeIds  article ids already in the order (skipped)
 * @param remainingKg free kg in the container to fill
 * @param trendMonths historical window used to compute WMA
 * @param strategy    coverage + filters
 */
export function buildContainerFill(
  articles: Article[],
  excludeIds: Set<number>,
  remainingKg: number,
  trendMonths: number,
  strategy: FillStrategy
): ContainerFillResult {
  if (remainingKg <= 0) return { entries: [], addedKg: 0 };

  const scored = score(articles, excludeIds, trendMonths, strategy);

  // Single criterion: rank by total profit per line (WMA × unit margin), keeping
  // only items that actually make money. `profitTotal > 0` already implies WMA > 0
  // and a positive margin, so this subsumes the old "exclude no rotation" filter.
  // The stable id tie-break makes equal-ranked selection repeatable (independent
  // of input order), which matters once the weight limit or `maxSkus` cuts mid-tie.
  const candidates = scored
    .filter((c) => c.profitTotal > 0)
    .sort((a, b) => b.profitTotal - a.profitTotal || a.article.id - b.article.id);

  const maxSkus = strategy.maxSkus && strategy.maxSkus > 0 ? strategy.maxSkus : Infinity;

  let remaining = remainingKg;
  const entries: ContainerFillEntry[] = [];

  const addLine = (c: ScoredCandidate, target: number) => {
    let qty = Math.min(target, c.headroom, Math.floor(remaining / c.weightPer));
    if (strategy.roundQuantities && qty >= 1) {
      qty = Math.min(roundQuantityNicely(qty), Math.floor(remaining / c.weightPer));
    }
    if (qty < 1) return; // nothing sensible fits
    entries.push({ article: c.article, quantity: qty });
    remaining -= qty * c.weightPer;
  };

  if (Number.isFinite(maxSkus)) {
    // Concentrated fill: take the top-N items and scale their quantities to FILL
    // the container with a UNIFORM coverage horizon. Fewer lines therefore carry
    // bigger quantities (the box still fills) — that's the point of the "Ítems"
    // control. `coverageMonths` is a floor: we never bring less than requested.
    const selected = candidates.slice(0, maxSkus);
    const demandKgPerMonth = selected.reduce((s, c) => s + c.wma * c.weightPer, 0);
    const fillMonths =
      demandKgPerMonth > 0 ? remainingKg / demandKgPerMonth : strategy.coverageMonths;
    const months = Math.max(strategy.coverageMonths, fillMonths);
    for (const c of selected) {
      if (remaining <= 0) break;
      addLine(c, Math.ceil(c.wma * months));
    }
  } else {
    // No line limit: bring period demand per item, diversified by the per-SKU
    // weight share, until the box is full or the candidates run out.
    const applyShare = strategy.maxShare !== undefined && strategy.maxShare > 0;
    for (const c of candidates) {
      if (remaining <= 0) break;
      const shareCap = applyShare
        ? Math.floor((remaining * strategy.maxShare!) / c.weightPer)
        : Infinity;
      addLine(c, Math.min(c.demandQty, shareCap));
    }
  }

  return { entries, addedKg: remainingKg - remaining };
}
