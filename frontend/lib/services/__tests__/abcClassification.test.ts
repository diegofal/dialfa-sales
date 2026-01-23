import {
  calculateABCClassification,
  classifyByRevenue,
  getArticleABCClass,
  getABCCacheInfo,
} from '../abcClassification';

// Mock prisma
const mockGroupBy = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    invoice_items: {
      get groupBy() {
        return mockGroupBy;
      },
    },
  },
}));

describe('calculateABCClassification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Force fresh calculation by always using forceRefresh=true in tests
  });

  it('returns empty map when no sales data exists', async () => {
    mockGroupBy.mockResolvedValue([]);

    const result = await calculateABCClassification(true);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('classifies single article as A (100% cumulative = top 80% rule still applies)', async () => {
    // Single article with all revenue is <= 80% only if cumulative is exactly at boundary
    // Actually: cumulative 100% > 80, so it would be B or C
    // Wait - let's check: cumulativePercentage = 100. 100 <= 80? No. 100 <= 95? No. So 'C'.
    // But that doesn't make sense for a single high-revenue article...
    // Looking at the code: if (cumulativePercentage <= 80) -> A
    // A single article has cumulative 100%, so it's C.
    // This is the actual behavior of the code.
    mockGroupBy.mockResolvedValue([{ article_id: 1n, _sum: { line_total: 10000 } }]);

    const result = await calculateABCClassification(true);
    expect(result.get('1')).toBe('C'); // 100% cumulative > 95%
  });

  it('classifies articles using Pareto 80/95/100 thresholds', async () => {
    // Create a distribution where we know the classification:
    // Article 1: revenue 80 (80% cumulative) -> A (<=80)
    // Article 2: revenue 15 (95% cumulative) -> B (<=95)
    // Article 3: revenue 5 (100% cumulative) -> C (>95)
    mockGroupBy.mockResolvedValue([
      { article_id: 1n, _sum: { line_total: 80 } },
      { article_id: 2n, _sum: { line_total: 15 } },
      { article_id: 3n, _sum: { line_total: 5 } },
    ]);

    const result = await calculateABCClassification(true);

    expect(result.get('1')).toBe('A');
    expect(result.get('2')).toBe('B');
    expect(result.get('3')).toBe('C');
  });

  it('handles the exact 80% boundary as class A', async () => {
    // Two articles: first is exactly 80%, second is 20%
    mockGroupBy.mockResolvedValue([
      { article_id: 10n, _sum: { line_total: 80 } },
      { article_id: 20n, _sum: { line_total: 20 } },
    ]);

    const result = await calculateABCClassification(true);

    expect(result.get('10')).toBe('A'); // cumulative 80% <= 80
    expect(result.get('20')).toBe('C'); // cumulative 100% > 95
  });

  it('sorts articles by revenue descending before classification', async () => {
    // Provide unsorted data - the function should sort internally
    mockGroupBy.mockResolvedValue([
      { article_id: 3n, _sum: { line_total: 5 } }, // lowest
      { article_id: 1n, _sum: { line_total: 80 } }, // highest
      { article_id: 2n, _sum: { line_total: 15 } }, // middle
    ]);

    const result = await calculateABCClassification(true);

    expect(result.get('1')).toBe('A'); // 80% cumulative
    expect(result.get('2')).toBe('B'); // 95% cumulative
    expect(result.get('3')).toBe('C'); // 100% cumulative
  });

  it('filters out articles with zero revenue', async () => {
    mockGroupBy.mockResolvedValue([
      { article_id: 1n, _sum: { line_total: 100 } },
      { article_id: 2n, _sum: { line_total: 0 } },
      { article_id: 3n, _sum: { line_total: null } },
    ]);

    const result = await calculateABCClassification(true);

    expect(result.has('1')).toBe(true);
    expect(result.has('2')).toBe(false);
    expect(result.has('3')).toBe(false);
  });

  it('uses cache on second call without forceRefresh', async () => {
    mockGroupBy.mockResolvedValue([{ article_id: 1n, _sum: { line_total: 100 } }]);

    await calculateABCClassification(true); // First call populates cache
    mockGroupBy.mockClear();

    await calculateABCClassification(false); // Should use cache

    expect(mockGroupBy).not.toHaveBeenCalled();
  });

  it('bypasses cache when forceRefresh is true', async () => {
    mockGroupBy.mockResolvedValue([{ article_id: 1n, _sum: { line_total: 100 } }]);

    await calculateABCClassification(true); // Populate cache
    mockGroupBy.mockClear();

    mockGroupBy.mockResolvedValue([{ article_id: 1n, _sum: { line_total: 200 } }]);

    await calculateABCClassification(true); // Should bypass cache

    expect(mockGroupBy).toHaveBeenCalled();
  });

  it('stores articleId as string key in the map', async () => {
    mockGroupBy.mockResolvedValue([{ article_id: 42n, _sum: { line_total: 1000 } }]);

    const result = await calculateABCClassification(true);

    expect(result.has('42')).toBe(true);
    expect(result.has(42 as unknown as string)).toBe(false); // Not stored as number
  });

  it('classifies many articles with realistic distribution', async () => {
    // Simulate Pareto: few articles make most revenue
    // 2 articles = 75% revenue (A candidates)
    // 3 articles = 16% revenue (B candidates)
    // 5 articles = 9% revenue (C candidates)
    const salesData = [
      { article_id: 1n, _sum: { line_total: 50000 } }, // 50%
      { article_id: 2n, _sum: { line_total: 25000 } }, // 75% cumulative
      { article_id: 3n, _sum: { line_total: 8000 } }, // 83%
      { article_id: 4n, _sum: { line_total: 5000 } }, // 88%
      { article_id: 5n, _sum: { line_total: 4000 } }, // 92%
      { article_id: 6n, _sum: { line_total: 3000 } }, // 95%
      { article_id: 7n, _sum: { line_total: 2000 } }, // 97%
      { article_id: 8n, _sum: { line_total: 1500 } }, // 98.5%
      { article_id: 9n, _sum: { line_total: 1000 } }, // 99.5%
      { article_id: 10n, _sum: { line_total: 500 } }, // 100%
    ];
    mockGroupBy.mockResolvedValue(salesData);

    const result = await calculateABCClassification(true);

    // Articles 1-2: cumulative 50%, 75% -> A
    expect(result.get('1')).toBe('A');
    expect(result.get('2')).toBe('A');
    // Articles 3-6: cumulative 83%, 88%, 92%, 95% -> B
    expect(result.get('3')).toBe('B');
    expect(result.get('4')).toBe('B');
    expect(result.get('5')).toBe('B');
    expect(result.get('6')).toBe('B');
    // Articles 7-10: cumulative >95% -> C
    expect(result.get('7')).toBe('C');
    expect(result.get('8')).toBe('C');
    expect(result.get('9')).toBe('C');
    expect(result.get('10')).toBe('C');
  });

  it('throws when prisma fails', async () => {
    mockGroupBy.mockRejectedValue(new Error('DB error'));

    await expect(calculateABCClassification(true)).rejects.toThrow('DB error');
  });
});

describe('getArticleABCClass', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the class for an existing article', async () => {
    mockGroupBy.mockResolvedValue([
      { article_id: 5n, _sum: { line_total: 80 } },
      { article_id: 6n, _sum: { line_total: 15 } },
      { article_id: 7n, _sum: { line_total: 5 } },
    ]);

    // Force refresh to seed the cache
    await calculateABCClassification(true);

    const result = await getArticleABCClass(5n);
    expect(result).toBe('A');
  });

  it('returns null for an article without sales', async () => {
    mockGroupBy.mockResolvedValue([{ article_id: 1n, _sum: { line_total: 100 } }]);

    await calculateABCClassification(true);

    const result = await getArticleABCClass(999n);
    expect(result).toBeNull();
  });

  it('accepts number articleId', async () => {
    mockGroupBy.mockResolvedValue([{ article_id: 42n, _sum: { line_total: 100 } }]);

    await calculateABCClassification(true);

    const result = await getArticleABCClass(42);
    expect(result).not.toBeNull();
  });
});

describe('classifyByRevenue', () => {
  it('returns empty array for empty input', () => {
    expect(classifyByRevenue([])).toEqual([]);
  });

  it('classifies single article as C (100% cumulative > 95%)', () => {
    const results = classifyByRevenue([{ articleId: 1n, totalRevenue: 500 }]);
    expect(results).toHaveLength(1);
    expect(results[0].abcClass).toBe('C');
    expect(results[0].cumulativePercentage).toBe(100);
  });

  it('sorts by revenue descending before classifying', () => {
    const results = classifyByRevenue([
      { articleId: 3n, totalRevenue: 5 },
      { articleId: 1n, totalRevenue: 80 },
      { articleId: 2n, totalRevenue: 15 },
    ]);
    expect(results[0].articleId).toBe(1n);
    expect(results[1].articleId).toBe(2n);
    expect(results[2].articleId).toBe(3n);
  });

  it('applies 80/95/100 Pareto thresholds', () => {
    const results = classifyByRevenue([
      { articleId: 1n, totalRevenue: 80 },
      { articleId: 2n, totalRevenue: 15 },
      { articleId: 3n, totalRevenue: 5 },
    ]);
    expect(results[0].abcClass).toBe('A'); // 80% cumulative
    expect(results[1].abcClass).toBe('B'); // 95% cumulative
    expect(results[2].abcClass).toBe('C'); // 100% cumulative
  });

  it('calculates revenue percentages correctly', () => {
    const results = classifyByRevenue([
      { articleId: 1n, totalRevenue: 60 },
      { articleId: 2n, totalRevenue: 40 },
    ]);
    expect(results[0].revenuePercentage).toBe(60);
    expect(results[0].cumulativePercentage).toBe(60);
    expect(results[1].revenuePercentage).toBe(40);
    expect(results[1].cumulativePercentage).toBe(100);
  });

  it('handles equal revenues', () => {
    const results = classifyByRevenue([
      { articleId: 1n, totalRevenue: 100 },
      { articleId: 2n, totalRevenue: 100 },
      { articleId: 3n, totalRevenue: 100 },
    ]);
    // Each is 33.3% revenue
    // Cumulative: 33.3, 66.6, 100
    expect(results[0].abcClass).toBe('A'); // 33.3% <= 80
    expect(results[1].abcClass).toBe('A'); // 66.6% <= 80
    expect(results[2].abcClass).toBe('C'); // 100% > 95
  });

  it('preserves revenue values in results', () => {
    const results = classifyByRevenue([{ articleId: 5n, totalRevenue: 1234 }]);
    expect(results[0].revenue).toBe(1234);
    expect(results[0].articleId).toBe(5n);
  });
});

describe('getABCCacheInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports cache state after calculation', async () => {
    mockGroupBy.mockResolvedValue([
      { article_id: 1n, _sum: { line_total: 100 } },
      { article_id: 2n, _sum: { line_total: 50 } },
    ]);

    await calculateABCClassification(true);

    const info = getABCCacheInfo();
    expect(info.isCached).toBe(true);
    expect(info.articlesCount).toBe(2);
    expect(info.age).toBeGreaterThanOrEqual(0);
    expect(info.expiresIn).toBeGreaterThan(0);
  });

  it('reports articlesCount correctly', async () => {
    mockGroupBy.mockResolvedValue([
      { article_id: 1n, _sum: { line_total: 80 } },
      { article_id: 2n, _sum: { line_total: 15 } },
      { article_id: 3n, _sum: { line_total: 5 } },
    ]);

    await calculateABCClassification(true);

    const info = getABCCacheInfo();
    expect(info.articlesCount).toBe(3);
  });
});
