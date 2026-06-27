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
  mode: 'money',
  coverageMonths: 6,
  excludeNoRotation: true,
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

describe('buildContainerFill — money mode', () => {
  it('ranks by profit per kg (higher first)', () => {
    // A: profit 50/u, 1 kg → 50/kg.  B: profit 80/u, 4 kg → 20/kg. A wins.
    const a = mkArticle({ id: 1, unitPrice: 100, lastPurchasePrice: 50, weightKg: 1 });
    const b = mkArticle({ id: 2, unitPrice: 100, lastPurchasePrice: 20, weightKg: 4 });
    const res = buildContainerFill([b, a], NO_EXCLUDE, 100, 6, baseStrategy);
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

describe('buildContainerFill — rotation mode', () => {
  it('ranks by sales velocity (WMA), ignoring margin', () => {
    // B sells faster but is less profitable; rotation should pick B first.
    const a = mkArticle({ id: 1, salesTrend: [5, 5, 5], unitPrice: 1000, lastPurchasePrice: 10 });
    const b = mkArticle({ id: 2, salesTrend: [50, 50, 50], unitPrice: 60, lastPurchasePrice: 50 });
    const res = buildContainerFill([a, b], NO_EXCLUDE, 10, 6, {
      ...baseStrategy,
      mode: 'rotation',
    });
    expect(res.entries[0].article.id).toBe(2);
  });

  it('includes profitable-unknown articles (no cost) since it ignores margin', () => {
    const a = mkArticle({ id: 1, lastPurchasePrice: null, salesTrend: [10, 10, 10] });
    const res = buildContainerFill([a], NO_EXCLUDE, 10_000, 6, {
      ...baseStrategy,
      mode: 'rotation',
    });
    expect(res.entries[0].quantity).toBe(60);
  });
});

describe('buildContainerFill — critical mode', () => {
  it('only includes items whose on-hand coverage is below the period', () => {
    // covered: stock 100 / WMA 10 = 10 months ≥ 6 → excluded
    const covered = mkArticle({ id: 1, salesTrend: [10, 10, 10], stock: 100 });
    // short: stock 10 / WMA 10 = 1 month < 6 → included, shortfall = 60-10 = 50
    const short = mkArticle({ id: 2, salesTrend: [10, 10, 10], stock: 10 });
    const res = buildContainerFill([covered, short], NO_EXCLUDE, 10_000, 6, {
      ...baseStrategy,
      mode: 'critical',
    });
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].article.id).toBe(2);
    expect(res.entries[0].quantity).toBe(50); // shortfall to reach 6 months
  });

  it('ranks by urgency (least coverage first)', () => {
    const urgent = mkArticle({ id: 1, salesTrend: [10, 10, 10], stock: 5 }); // 0.5 mo
    const lessUrgent = mkArticle({ id: 2, salesTrend: [10, 10, 10], stock: 30 }); // 3 mo
    const res = buildContainerFill([lessUrgent, urgent], NO_EXCLUDE, 10, 6, {
      ...baseStrategy,
      mode: 'critical',
    });
    expect(res.entries[0].article.id).toBe(1);
  });
});

describe('buildContainerFill — excludeNoRotation', () => {
  it('drops never-sold articles from rotation mode', () => {
    const dead = mkArticle({ id: 1, salesTrend: [0, 0, 0] });
    const res = buildContainerFill([dead], NO_EXCLUDE, 10_000, 6, {
      ...baseStrategy,
      mode: 'rotation',
      excludeNoRotation: true,
    });
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
