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

/**
 * Real CIF-adjusted cost = lastPurchasePrice * (1 + cifPercentage/100).
 * Falls back to lastPurchasePrice alone when cifPercentage is missing.
 * Returns null when lastPurchasePrice is missing or zero.
 */
export function getArticleCifCost(article: {
  lastPurchasePrice?: number | null;
  cifPercentage?: number | null;
}): number | null {
  const fob = article.lastPurchasePrice;
  if (fob === null || fob === undefined || fob <= 0) return null;
  const cif = article.cifPercentage;
  if (cif === null || cif === undefined || cif <= 0) return fob;
  return fob * (1 + cif / 100);
}

/**
 * Effective category discount for margin = the largest payment-term discount
 * configured for the category. Falls back to categoryDefaultDiscount when
 * no payment-term discounts exist (legacy data).
 */
export function getEffectiveCategoryDiscount(article: {
  categoryMaxPaymentDiscount?: number | null;
  categoryDefaultDiscount?: number | null;
}): number {
  const max = article.categoryMaxPaymentDiscount ?? 0;
  if (max > 0) return max;
  return article.categoryDefaultDiscount ?? 0;
}

/**
 * Returns the discount % for the article in a given context.
 *
 * - When `paymentTermId` is provided (e.g. a client is selected): use the
 *   `category_payment_discounts` row matching that paymentTermId, falling back
 *   to `categoryDefaultDiscount` if no row matches. This is what the pedido
 *   form does when computing per-line discounts.
 *
 * - When `paymentTermId` is null/undefined (catalog views with no client
 *   context, or before a client is picked): use the largest available
 *   payment-term discount (`categoryMaxPaymentDiscount`), falling back to
 *   `categoryDefaultDiscount`. Matches the existing
 *   `getEffectiveCategoryDiscount` behavior.
 */
export function getArticleEffectiveDiscount(
  article: {
    categoryPaymentDiscounts?: Array<{
      paymentTermId?: number | null;
      discountPercent: number;
    }>;
    categoryMaxPaymentDiscount?: number | null;
    categoryDefaultDiscount?: number | null;
  },
  paymentTermId?: number | null
): number {
  if (paymentTermId) {
    const match = article.categoryPaymentDiscounts?.find((d) => d.paymentTermId === paymentTermId);
    if (match) return match.discountPercent;
    return article.categoryDefaultDiscount ?? 0;
  }
  return getEffectiveCategoryDiscount(article);
}

/**
 * Discounted sell price = unitPrice * (1 - effectiveDiscount/100).
 * Mirrors supplier-orders/[id]/page.tsx:235.
 *
 * Pass a `paymentTermId` to use that specific payment term's discount (e.g.
 * when a client is in context). Without one, defaults to the largest
 * payment-term discount available (catalog/no-client behavior).
 */
export function getArticleDiscountedSellPrice(
  article: {
    unitPrice?: number | null;
    categoryPaymentDiscounts?: Array<{
      paymentTermId?: number | null;
      discountPercent: number;
    }>;
    categoryMaxPaymentDiscount?: number | null;
    categoryDefaultDiscount?: number | null;
  },
  paymentTermId?: number | null
): number | null {
  const unit = article.unitPrice;
  if (unit === null || unit === undefined) return null;
  const discount = getArticleEffectiveDiscount(article, paymentTermId);
  return unit * (1 - discount / 100);
}

/**
 * Article margin = (discountedSellPrice - cifCost) / cifCost * 100.
 * Mirrors supplier-orders/[id]/page.tsx:240.
 *
 * Pass a `paymentTermId` to compute margin against that client's specific
 * payment-term discount; without it, uses the largest discount.
 */
export function getArticleMarginPercent(
  article: {
    unitPrice?: number | null;
    lastPurchasePrice?: number | null;
    cifPercentage?: number | null;
    categoryPaymentDiscounts?: Array<{
      paymentTermId?: number | null;
      discountPercent: number;
    }>;
    categoryMaxPaymentDiscount?: number | null;
    categoryDefaultDiscount?: number | null;
  },
  paymentTermId?: number | null
): number | null {
  const cifCost = getArticleCifCost(article);
  const sell = getArticleDiscountedSellPrice(article, paymentTermId);
  return calculateMarginPercent(sell, cifCost);
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

export interface MarginItem {
  quantity: number;
  unitPrice: number;
  cifCost: number | null;
}

/**
 * Aggregate margin over a list of items. Items without a cifCost are
 * counted in revenue but excluded from cost — so the returned marginPercent
 * is the margin over the items that DO have cost data. Returns null margin
 * only when no item has cost data at all.
 */
export function calculateOrderMargin(items: MarginItem[]): {
  totalRevenue: number;
  totalCost: number;
  profit: number;
  marginPercent: number | null;
} {
  let totalRevenue = 0;
  let totalCost = 0;
  let hasCost = false;
  for (const item of items) {
    totalRevenue += item.quantity * item.unitPrice;
    if (item.cifCost !== null && item.cifCost > 0) {
      totalCost += item.quantity * item.cifCost;
      hasCost = true;
    }
  }
  if (!hasCost || totalCost === 0) {
    return { totalRevenue, totalCost: 0, profit: 0, marginPercent: null };
  }
  const profit = totalRevenue - totalCost;
  return {
    totalRevenue,
    totalCost,
    profit,
    marginPercent: (profit / totalCost) * 100,
  };
}

/**
 * Combined display: "+25.0% · $1,234.56" or "—" if margin is null.
 * formatCurrency is injected so callers control the locale/currency.
 */
export function formatMarginWithProfit(
  margin: number | null,
  profit: number,
  formatCurrency: (n: number) => string
): string {
  if (margin === null) return '—';
  return `${formatMarginPercent(margin)} · ${formatCurrency(profit)}`;
}
