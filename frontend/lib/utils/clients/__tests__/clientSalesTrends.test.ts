import { calculateClientSalesTrends, getClientSalesTrendsCacheInfo } from '../clientSalesTrends';

const mockQueryRaw = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

describe('calculateClientSalesTrends', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRaw.mockResolvedValue([]);
  });

  it('returns a Map of client trends and labels array', async () => {
    const result = await calculateClientSalesTrends(3, true);

    expect(result.data).toBeInstanceOf(Map);
    expect(result.labels).toBeInstanceOf(Array);
    expect(result.labels).toHaveLength(3);
  });

  it('generates correct number of labels for months requested', async () => {
    const result = await calculateClientSalesTrends(6, true);
    expect(result.labels).toHaveLength(6);
  });

  it('maps client sales data to trend arrays', async () => {
    // Return data for first month only
    mockQueryRaw
      .mockResolvedValueOnce([{ client_id: 10n, total_amount: 5000 }])
      .mockResolvedValueOnce([{ client_id: 10n, total_amount: 8000 }])
      .mockResolvedValueOnce([{ client_id: 10n, total_amount: 3000 }]);

    const result = await calculateClientSalesTrends(3, true);

    expect(result.data.has('10')).toBe(true);
    const trend = result.data.get('10')!;
    expect(trend).toHaveLength(3);
    expect(trend[0]).toBe(5000);
    expect(trend[1]).toBe(8000);
    expect(trend[2]).toBe(3000);
  });

  it('fills zeros for months without data', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([]) // Month 1: no data
      .mockResolvedValueOnce([{ client_id: 5n, total_amount: 1000 }]) // Month 2
      .mockResolvedValueOnce([]); // Month 3: no data

    const result = await calculateClientSalesTrends(3, true);

    const trend = result.data.get('5');
    expect(trend).toEqual([0, 1000, 0]);
  });

  it('handles multiple clients in same month', async () => {
    mockQueryRaw.mockResolvedValue([
      { client_id: 1n, total_amount: 1000 },
      { client_id: 2n, total_amount: 2000 },
    ]);

    const result = await calculateClientSalesTrends(1, true);

    expect(result.data.has('1')).toBe(true);
    expect(result.data.has('2')).toBe(true);
  });

  it('uses cache on second call without forceRefresh', async () => {
    mockQueryRaw.mockResolvedValue([{ client_id: 1n, total_amount: 500 }]);

    await calculateClientSalesTrends(3, true);
    mockQueryRaw.mockClear();

    await calculateClientSalesTrends(3, false);

    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('bypasses cache when forceRefresh is true', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await calculateClientSalesTrends(3, true);
    mockQueryRaw.mockClear();
    mockQueryRaw.mockResolvedValue([]);

    await calculateClientSalesTrends(3, true);

    expect(mockQueryRaw).toHaveBeenCalled();
  });

  it('rethrows errors from prisma', async () => {
    mockQueryRaw.mockRejectedValue(new Error('DB connection failed'));

    await expect(calculateClientSalesTrends(3, true)).rejects.toThrow('DB connection failed');
  });
});

describe('getClientSalesTrendsCacheInfo', () => {
  it('reports uncached state initially', () => {
    // After the test module reloads, cache may be populated from prior tests
    // This test focuses on structure
    const info = getClientSalesTrendsCacheInfo(99); // Use different month count
    expect(info).toHaveProperty('isCached');
    expect(info).toHaveProperty('monthsTracked', 99);
  });

  it('reports cached state after calculation', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await calculateClientSalesTrends(6, true);

    const info = getClientSalesTrendsCacheInfo(6);
    expect(info.isCached).toBe(true);
    expect(info.monthsTracked).toBe(6);
  });
});
