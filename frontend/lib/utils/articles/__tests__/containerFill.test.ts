import { Article } from '@/types/article';
import { buildContainerFill, roundQuantityNicely, type FillStrategy } from '../containerFill';

/**
 * Article factory with predictable economics:
 * - cifPercentage 0 → CIF cost = lastPurchasePrice
 * - no category discount → sell price = unitPrice
 * - flat salesTrend → WMA = the flat value
 */
function mkArticle(over: Partial<Article> & { id: number }): Article {
  return {
    code: `A${over.id}`,
    description: `Article ${over.id}`,
    categoryId: 0,
    categoryName: '',
    categoryDefaultDiscount: 0,
    categoryMaxPaymentDiscount: 0,
    unitPrice: 100,
    stock: 0,
    minimumStock: 0,
    location: null,
    isDiscontinued: false,
    notes: null,
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
    isLowStock: false,
    weightKg: 1,
    lastPurchasePrice: 50,
    cifPercentage: 0,
    salesTrend: [10, 10, 10],
    ...over,
  } as Article;
}

const baseStrategy: FillStrategy = {
  coverageMonths: 6,
  maxStockMonths: 0, // no over-stock cap unless a test sets it
};

const NO_EXCLUDE = new Set<number>();

describe('roundQuantityNicely', () => {
  it('keeps small quantities as-is (ceil, min 1)', () => {
    expect(roundQuantityNicely(0)).toBe(1);
    expect(roundQuantityNicely(1)).toBe(1);
    expect(roundQuantityNicely(7)).toBe(7);
    expect(roundQuantityNicely(10)).toBe(10);
  });

  it('rounds up to magnitude-scaled increments', () => {
    expect(roundQuantityNicely(11)).toBe(15); // step 5
    expect(roundQuantityNicely(53)).toBe(60); // step 10
    expect(roundQuantityNicely(187)).toBe(190); // step 10
    expect(roundQuantityNicely(201)).toBe(225); // step 25
    expect(roundQuantityNicely(1001)).toBe(1100); // step 100
    expect(roundQuantityNicely(5001)).toBe(5500); // step 500
  });
});

describe('buildContainerFill — guards', () => {
  it('returns nothing when there is no remaining capacity', () => {
    const res = buildContainerFill([mkArticle({ id: 1 })], NO_EXCLUDE, 0, 6, baseStrategy);
    expect(res.entries).toHaveLength(0);
    expect(res.addedKg).toBe(0);
  });

  it('skips articles without a weight', () => {
    const res = buildContainerFill(
      [mkArticle({ id: 1, weightKg: null })],
      NO_EXCLUDE,
      1000,
      6,
      baseStrategy
    );
    expect(res.entries).toHaveLength(0);
  });

  it('skips articles already in the order', () => {
    const res = buildContainerFill([mkArticle({ id: 1 })], new Set([1]), 1000, 6, baseStrategy);
    expect(res.entries).toHaveLength(0);
  });
});

describe('buildContainerFill — profit ranking (single mode)', () => {
  it('ranks by TOTAL profit per line (WMA × margin), not profit per kg', () => {
    // workhorse: WMA 100, margin 5/u → total 500 (per-kg only 5).
    // boutique:  WMA 1,  margin 50/u → total 50  (per-kg 500 — would win the old money mode).
    const workhorse = mkArticle({
      id: 1,
      salesTrend: [100, 100, 100],
      unitPrice: 55,
      lastPurchasePrice: 50,
      weightKg: 1,
    });
    const boutique = mkArticle({
      id: 2,
      salesTrend: [1, 1, 1],
      unitPrice: 100,
      lastPurchasePrice: 50,
      weightKg: 0.1,
    });
    // tiny container → only the top-ranked line fits
    const res = buildContainerFill([boutique, workhorse], NO_EXCLUDE, 1, 6, baseStrategy);
    expect(res.entries[0].article.id).toBe(1);
  });

  it('brings period demand = ceil(WMA × coverageMonths)', () => {
    const a = mkArticle({ id: 1, salesTrend: [10, 10, 10], weightKg: 1 }); // WMA 10
    const res = buildContainerFill([a], NO_EXCLUDE, 10_000, 6, baseStrategy);
    expect(res.entries[0].quantity).toBe(60); // 10 × 6
  });

  it('does NOT subtract current stock (money ignores stock without a cap)', () => {
    const a = mkArticle({ id: 1, salesTrend: [10, 10, 10], stock: 1000, weightKg: 1 });
    const res = buildContainerFill([a], NO_EXCLUDE, 10_000, 6, baseStrategy);
    expect(res.entries[0].quantity).toBe(60);
  });

  it('excludes unprofitable articles (margin ≤ 0)', () => {
    const a = mkArticle({ id: 1, unitPrice: 50, lastPurchasePrice: 50 }); // profit 0
    const res = buildContainerFill([a], NO_EXCLUDE, 10_000, 6, baseStrategy);
    expect(res.entries).toHaveLength(0);
  });

  it('excludes articles with no cost loaded (cannot assess profit)', () => {
    const a = mkArticle({ id: 1, lastPurchasePrice: null });
    const res = buildContainerFill([a], NO_EXCLUDE, 10_000, 6, baseStrategy);
    expect(res.entries).toHaveLength(0);
  });

  it('caps quantity by remaining container weight', () => {
    // WMA 100 → demand 600, but only 50 kg free at 1 kg/u → 50 units
    const a = mkArticle({ id: 1, salesTrend: [100, 100, 100], weightKg: 1 });
    const res = buildContainerFill([a], NO_EXCLUDE, 50, 6, baseStrategy);
    expect(res.entries[0].quantity).toBe(50);
    expect(res.addedKg).toBe(50);
  });

  it('stops once the container is full', () => {
    const a = mkArticle({ id: 1, salesTrend: [100, 100, 100], weightKg: 1 }); // demand 600
    const b = mkArticle({ id: 2, salesTrend: [100, 100, 100], weightKg: 1 });
    const res = buildContainerFill([a, b], NO_EXCLUDE, 600, 6, baseStrategy);
    expect(res.addedKg).toBe(600);
    // a fills it entirely; b gets nothing
    expect(res.entries).toHaveLength(1);
  });
});

describe('buildContainerFill — over-stock cap (maxStockMonths)', () => {
  it('limits quantity so stock + order ≤ maxStockMonths of demand', () => {
    // WMA 10, stock 100 (=10 months). Cap 12 months → headroom 20. Demand(6mo)=60.
    const a = mkArticle({ id: 1, salesTrend: [10, 10, 10], stock: 100, weightKg: 1 });
    const res = buildContainerFill([a], NO_EXCLUDE, 10_000, 6, {
      ...baseStrategy,
      maxStockMonths: 12,
    });
    expect(res.entries[0].quantity).toBe(20);
  });

  it('skips an article already over the cap', () => {
    const a = mkArticle({ id: 1, salesTrend: [10, 10, 10], stock: 500, weightKg: 1 }); // 50 months
    const res = buildContainerFill([a], NO_EXCLUDE, 10_000, 6, {
      ...baseStrategy,
      maxStockMonths: 12,
    });
    expect(res.entries).toHaveLength(0);
  });
});

describe('buildContainerFill — never-sold articles', () => {
  it('drops articles with WMA = 0 (profitTotal = 0) without an explicit flag', () => {
    const dead = mkArticle({ id: 1, salesTrend: [0, 0, 0] });
    const res = buildContainerFill([dead], NO_EXCLUDE, 10_000, 6, baseStrategy);
    expect(res.entries).toHaveLength(0);
  });
});

describe('buildContainerFill — roundQuantities', () => {
  it('rounds quantities to nice increments without exceeding weight', () => {
    // WMA 31 → demand(6) = 186 → rounds to 190
    const a = mkArticle({ id: 1, salesTrend: [31, 31, 31], weightKg: 1 });
    const res = buildContainerFill([a], NO_EXCLUDE, 10_000, 6, {
      ...baseStrategy,
      roundQuantities: true,
    });
    expect(res.entries[0].quantity).toBe(190);
  });
});

describe('buildContainerFill — maxSkus', () => {
  it('limits the number of distinct lines to the top-ranked items', () => {
    // Three profitable items; cap at 2 lines.
    const a = mkArticle({ id: 1, unitPrice: 100, lastPurchasePrice: 10, weightKg: 1 }); // best
    const b = mkArticle({ id: 2, unitPrice: 100, lastPurchasePrice: 20, weightKg: 1 });
    const c = mkArticle({ id: 3, unitPrice: 100, lastPurchasePrice: 30, weightKg: 1 });
    const res = buildContainerFill([a, b, c], NO_EXCLUDE, 100_000, 6, {
      ...baseStrategy,
      maxSkus: 2,
    });
    expect(res.entries).toHaveLength(2);
    expect(res.entries.map((e) => e.article.id)).toEqual([1, 2]);
  });

  it('ignores the per-SKU share cap when an item limit is set (concentrates)', () => {
    // demand huge; with maxShare alone it would cap at 50 units, but maxSkus
    // disables the share cap so it fills by weight (100 units).
    const a = mkArticle({ id: 1, salesTrend: [1000, 1000, 1000], weightKg: 1 });
    const res = buildContainerFill([a], NO_EXCLUDE, 100, 6, {
      ...baseStrategy,
      maxShare: 0.5,
      maxSkus: 5,
    });
    expect(res.entries[0].quantity).toBe(100);
  });
});

describe('buildContainerFill — categoryIds', () => {
  it('only considers articles in the selected categories', () => {
    const a = mkArticle({ id: 1, categoryId: 10 });
    const b = mkArticle({ id: 2, categoryId: 20 });
    const res = buildContainerFill([a, b], NO_EXCLUDE, 100_000, 6, {
      ...baseStrategy,
      categoryIds: [20],
    });
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].article.id).toBe(2);
  });

  it('considers all categories when the list is empty', () => {
    const a = mkArticle({ id: 1, categoryId: 10 });
    const b = mkArticle({ id: 2, categoryId: 20 });
    const res = buildContainerFill([a, b], NO_EXCLUDE, 100_000, 6, {
      ...baseStrategy,
      categoryIds: [],
    });
    expect(res.entries).toHaveLength(2);
  });
});

describe('buildContainerFill — maxShare', () => {
  it('limits how much of the remaining space a single SKU may take', () => {
    // demand huge, but maxShare 0.5 of 100 kg = 50 kg → 50 units at 1 kg
    const a = mkArticle({ id: 1, salesTrend: [1000, 1000, 1000], weightKg: 1 });
    const res = buildContainerFill([a], NO_EXCLUDE, 100, 6, {
      ...baseStrategy,
      maxShare: 0.5,
    });
    expect(res.entries[0].quantity).toBe(50);
  });
});

describe('buildContainerFill — blockedOrigins (sourcing)', () => {
  it('drops articles whose origin is blocked, keeps china/both/unknown', () => {
    const india = mkArticle({ id: 1, importOrigin: 'india' });
    const china = mkArticle({ id: 2, importOrigin: 'china' });
    const both = mkArticle({ id: 3, importOrigin: 'both' });
    const unknown = mkArticle({ id: 4, importOrigin: null });
    const res = buildContainerFill([india, china, both, unknown], NO_EXCLUDE, 10_000, 6, {
      ...baseStrategy,
      blockedOrigins: ['india'],
    });
    const ids = res.entries.map((e) => e.article.id).sort();
    expect(ids).toEqual([2, 3, 4]);
  });

  it('no origin filter when blockedOrigins is empty/undefined', () => {
    const india = mkArticle({ id: 1, importOrigin: 'india' });
    const res = buildContainerFill([india], NO_EXCLUDE, 10_000, 6, baseStrategy);
    expect(res.entries).toHaveLength(1);
  });
});

describe('buildContainerFill — minMonthsWithSales (papa caliente)', () => {
  it('drops one-shots and keeps recurrent sellers', () => {
    // one-shot: a single month with sales out of 12; recurrent: every month.
    const oneShot = mkArticle({ id: 1, salesTrend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 600] });
    const recurrent = mkArticle({ id: 2, salesTrend: Array(12).fill(5) });
    const res = buildContainerFill([oneShot, recurrent], NO_EXCLUDE, 10_000, 12, {
      ...baseStrategy,
      minMonthsWithSales: 8,
    });
    expect(res.entries.map((e) => e.article.id)).toEqual([2]);
  });
});

describe('buildContainerFill — determinism / repeatability', () => {
  // Four articles with IDENTICAL economics (same profitPerKg and WMA), so every
  // ranking metric ties. Only the id tie-break decides order/selection.
  const tied = (ids: number[]) =>
    ids.map((id) =>
      mkArticle({
        id,
        unitPrice: 100,
        lastPurchasePrice: 50,
        weightKg: 1,
        salesTrend: [10, 10, 10],
      })
    );

  it('equal-profit items are selected lowest-id-first, regardless of input order', () => {
    const strat: FillStrategy = { ...baseStrategy, maxSkus: 2 };
    const a = buildContainerFill(tied([4, 2, 3, 1]), NO_EXCLUDE, 10_000, 6, strat);
    const b = buildContainerFill(tied([1, 3, 2, 4]), NO_EXCLUDE, 10_000, 6, strat);
    expect(a.entries.map((e) => e.article.id)).toEqual([1, 2]);
    expect(b.entries.map((e) => e.article.id)).toEqual([1, 2]);
  });

  it('tie-break keeps the full ordering stable across input shuffles', () => {
    const a = buildContainerFill(tied([3, 1, 4, 2]), NO_EXCLUDE, 10_000, 6, baseStrategy);
    const b = buildContainerFill(tied([2, 4, 1, 3]), NO_EXCLUDE, 10_000, 6, baseStrategy);
    expect(a.entries.map((e) => e.article.id)).toEqual([1, 2, 3, 4]);
    expect(b.entries.map((e) => e.article.id)).toEqual([1, 2, 3, 4]);
  });
});
