import { Article } from '@/types/article';
import { composeContainerOrder } from '../composeContainerOrder';
import { buildContainerFill, type FillStrategy } from '../containerFill';

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

const strategy: FillStrategy = {
  mode: 'money',
  coverageMonths: 6,
  excludeNoRotation: true,
  maxStockMonths: 0,
};

function compose(
  catalog: Article[],
  manualQty: Map<number, number>,
  removedIds: Set<number>,
  capacityKg: number
) {
  const byId = new Map(catalog.map((a) => [a.id, a]));
  return composeContainerOrder({
    catalog,
    resolveArticle: (id) => byId.get(id),
    manualQty,
    removedIds,
    trendMonths: 6,
    strategy,
    capacityKg,
  });
}

describe('composeContainerOrder', () => {
  it('returns null when the catalog is empty', () => {
    expect(compose([], new Map(), new Set(), 1000)).toBeNull();
  });

  it('with no overrides equals buildContainerFill over full capacity', () => {
    const catalog = [mkArticle({ id: 1 }), mkArticle({ id: 2 })];
    const res = compose(catalog, new Map(), new Set(), 1000)!;
    const direct = buildContainerFill(catalog, new Set(), 1000, 6, {
      ...strategy,
      roundQuantities: true,
      maxShare: 0.1,
    });
    expect(res.entries.map((e) => [e.article.id, e.quantity])).toEqual(
      direct.entries.map((e) => [e.article.id, e.quantity])
    );
  });

  it('emits a pinned line verbatim and excludes it from the auto pool', () => {
    const catalog = [mkArticle({ id: 1 }), mkArticle({ id: 2 })];
    const res = compose(catalog, new Map([[1, 999]]), new Set(), 100_000)!;
    const pinned = res.entries.find((e) => e.article.id === 1)!;
    expect(pinned.quantity).toBe(999);
    // id 1 should appear exactly once (not also auto-added)
    expect(res.entries.filter((e) => e.article.id === 1)).toHaveLength(1);
  });

  it('never includes a removed line even if it ranks high', () => {
    const best = mkArticle({ id: 1, unitPrice: 1000, lastPurchasePrice: 10 }); // top profit/kg
    const other = mkArticle({ id: 2 });
    const res = compose([best, other], new Map(), new Set([1]), 100_000)!;
    expect(res.entries.some((e) => e.article.id === 1)).toBe(false);
  });

  it('subtracts manual weight from the capacity available to the auto fill', () => {
    const a = mkArticle({ id: 1, weightKg: 1 });
    const b = mkArticle({ id: 2, weightKg: 1, salesTrend: [1000, 1000, 1000] });
    // pin 30 kg of A; only 70 kg left for B (capacity 100)
    const res = compose([a, b], new Map([[1, 30]]), new Set(), 100)!;
    expect(res.manualKg).toBe(30);
    const bQty = res.entries.find((e) => e.article.id === 2)!.quantity;
    expect(bQty).toBeLessThanOrEqual(70);
  });

  it('when a pin exceeds capacity the auto fill adds nothing', () => {
    const a = mkArticle({ id: 1, weightKg: 1 });
    const b = mkArticle({ id: 2, weightKg: 1 });
    const res = compose([a, b], new Map([[1, 200]]), new Set(), 100)!;
    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].article.id).toBe(1);
  });

  it('a reset line (absent from both maps) recomputes as auto', () => {
    const catalog = [mkArticle({ id: 1 })];
    const res = compose(catalog, new Map(), new Set(), 100_000)!;
    expect(res.entries[0].article.id).toBe(1);
    expect(res.entries[0].quantity).toBeGreaterThan(0);
  });

  it('resolves a pinned article that is not in the catalog via the fallback resolver', () => {
    const inCatalog = mkArticle({ id: 1 });
    const filteredOut = mkArticle({ id: 99, weightKg: 2 });
    const res = composeContainerOrder({
      catalog: [inCatalog],
      resolveArticle: (id) => (id === 99 ? filteredOut : inCatalog),
      manualQty: new Map([[99, 5]]),
      removedIds: new Set(),
      trendMonths: 6,
      strategy,
      capacityKg: 100_000,
    })!;
    const pinned = res.entries.find((e) => e.article.id === 99);
    expect(pinned?.quantity).toBe(5);
  });
});
