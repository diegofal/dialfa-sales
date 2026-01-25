import {
  calculateSalesTrends,
  getArticleSalesTrend,
  getSalesTrendsCacheInfo,
} from '../salesTrends';

const mockQueryRaw = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

describe('calculateSalesTrends', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRaw.mockResolvedValue([]);
  });

  it('returns a Map of article trends and labels array', async () => {
    const result = await calculateSalesTrends(3, true);

    expect(result.data).toBeInstanceOf(Map);
    expect(result.labels).toBeInstanceOf(Array);
    expect(result.labels).toHaveLength(3);
  });

  it('maps article sales quantities to trend arrays', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ article_id: 42n, total_quantity: 10 }])
      .mockResolvedValueOnce([{ article_id: 42n, total_quantity: 20 }])
      .mockResolvedValueOnce([{ article_id: 42n, total_quantity: 30 }]);

    const result = await calculateSalesTrends(3, true);

    const trend = result.data.get('42');
    expect(trend).toEqual([10, 20, 30]);
  });

  it('fills zeros for months without sales', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ article_id: 1n, total_quantity: 5 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ article_id: 1n, total_quantity: 15 }]);

    const result = await calculateSalesTrends(3, true);

    expect(result.data.get('1')).toEqual([5, 0, 15]);
  });

  it('handles multiple articles', async () => {
    mockQueryRaw.mockResolvedValue([
      { article_id: 1n, total_quantity: 100 },
      { article_id: 2n, total_quantity: 50 },
    ]);

    const result = await calculateSalesTrends(1, true);

    expect(result.data.has('1')).toBe(true);
    expect(result.data.has('2')).toBe(true);
  });

  it('uses cache on subsequent calls', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await calculateSalesTrends(4, true);
    mockQueryRaw.mockClear();

    await calculateSalesTrends(4, false);

    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('bypasses cache with forceRefresh', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await calculateSalesTrends(4, true);
    mockQueryRaw.mockClear();
    mockQueryRaw.mockResolvedValue([]);

    await calculateSalesTrends(4, true);

    expect(mockQueryRaw).toHaveBeenCalled();
  });

  it('rethrows database errors', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Query timeout'));
    await expect(calculateSalesTrends(3, true)).rejects.toThrow('Query timeout');
  });
});

describe('getArticleSalesTrend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRaw.mockResolvedValue([]);
  });

  it('returns null for article with no sales', async () => {
    await calculateSalesTrends(3, true); // Seed cache
    const result = await getArticleSalesTrend(999n, 3);
    expect(result).toBeNull();
  });

  it('returns trend data for article with sales', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ article_id: 5n, total_quantity: 10 }])
      .mockResolvedValueOnce([{ article_id: 5n, total_quantity: 20 }]);

    await calculateSalesTrends(2, true); // Seed cache
    const result = await getArticleSalesTrend(5n, 2);

    expect(result).not.toBeNull();
    expect(result?.articleId).toBe('5');
    expect(result?.trend).toEqual([10, 20]);
    expect(result?.totalSales).toBe(30);
    expect(result?.labels).toHaveLength(2);
  });
});

describe('getSalesTrendsCacheInfo', () => {
  it('returns cache metadata', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await calculateSalesTrends(6, true);

    const info = getSalesTrendsCacheInfo(6);
    expect(info.isCached).toBe(true);
    expect(info.monthsTracked).toBe(6);
    expect(info.labels).toHaveLength(6);
  });

  it('reports uncached for different month count', () => {
    const info = getSalesTrendsCacheInfo(99);
    expect(info.isCached).toBe(false);
    expect(info.articlesCount).toBe(0);
  });
});
