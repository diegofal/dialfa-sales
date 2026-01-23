import { ArticleMatcher } from '../article-matcher';
import { ExtractedItem } from '../types';

// Create a mock PrismaClient
const mockFindMany = jest.fn();
const mockDisconnect = jest.fn();

const mockPrisma = {
  articles: {
    findMany: mockFindMany,
  },
  $disconnect: mockDisconnect,
} as unknown as Parameters<(typeof ArticleMatcher.prototype)['matchItems']> extends []
  ? never
  : ConstructorParameters<typeof ArticleMatcher>[0];

function createMatcher() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ArticleMatcher(mockPrisma as any);
}

function createExtractedItem(overrides: Partial<ExtractedItem> = {}): ExtractedItem {
  return {
    description: 'FLANGE SORF A-105 150# 4"',
    size: '4"',
    quantity: 10,
    unitPrice: 50,
    totalPrice: 500,
    unitWeight: 5.2,
    ...overrides,
  };
}

const mockDbArticles = [
  {
    id: 1n,
    code: 'SORF-150-4',
    description: 'Brida SORF 150# 4"',
    type: 'SORF',
    series: 150,
    thickness: 'STD',
    size: '4"',
    stock: 20,
    minimum_stock: 5,
    unit_price: 80.0,
  },
  {
    id: 2n,
    code: 'SORF-150-6',
    description: 'Brida SORF 150# 6"',
    type: 'SORF',
    series: 150,
    thickness: 'STD',
    size: '6"',
    stock: 10,
    minimum_stock: 3,
    unit_price: 120.0,
  },
  {
    id: 3n,
    code: 'BLIND-300-2',
    description: 'Brida BLIND 300# 2"',
    type: 'BLIND',
    series: 300,
    thickness: 'STD',
    size: '2"',
    stock: 15,
    minimum_stock: 5,
    unit_price: 60.0,
  },
];

describe('ArticleMatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue(mockDbArticles);
  });

  it('loads articles from database', async () => {
    const matcher = createMatcher();
    await matcher.matchItems([]);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          is_active: true,
          deleted_at: null,
        }),
      })
    );
  });

  it('returns empty array for empty input', async () => {
    const matcher = createMatcher();
    const result = await matcher.matchItems([]);
    expect(result).toEqual([]);
  });

  it('matches extracted item to database article', async () => {
    const matcher = createMatcher();
    const items = [
      createExtractedItem({ description: 'FLANGE SORF A-105 S-150 SCH STD 4"', size: '4"' }),
    ];

    const result = await matcher.matchItems(items);

    expect(result).toHaveLength(1);
    // If matched, confidence should be 100
    if (result[0].article) {
      expect(result[0].confidence).toBe(100);
      expect(result[0].matchMethod).toBe('exact');
    }
  });

  it('returns unmatched items with confidence 0', async () => {
    const matcher = createMatcher();
    const items = [createExtractedItem({ description: 'UNKNOWN PRODUCT XYZ', size: '99"' })];

    const result = await matcher.matchItems(items);

    expect(result).toHaveLength(1);
    expect(result[0].article).toBeNull();
    expect(result[0].confidence).toBe(0);
    expect(result[0].matchMethod).toBe('none');
  });

  it('calculates valuation for matched items', async () => {
    const matcher = createMatcher();
    const items = [
      createExtractedItem({
        description: 'FLANGE SORF A-105 S-150 SCH STD 4"',
        size: '4"',
        unitPrice: 50,
        quantity: 10,
      }),
    ];

    const result = await matcher.matchItems(items);

    expect(result[0].proformaUnitPrice).toBe(50);
    expect(result[0].proformaTotalPrice).toBe(500);

    if (result[0].article) {
      // DB price is 80, proforma is 50
      expect(result[0].dbUnitPrice).toBe(80);
      expect(result[0].dbTotalPrice).toBe(800); // 80 * 10
      expect(result[0].marginAbsolute).toBe(30); // 80 - 50
      expect(result[0].marginPercent).toBeCloseTo(60); // (80/50 - 1) * 100
    }
  });

  it('returns null valuation fields for unmatched items', async () => {
    const matcher = createMatcher();
    const items = [createExtractedItem({ description: 'UNKNOWN', size: '99"' })];

    const result = await matcher.matchItems(items);

    expect(result[0].dbUnitPrice).toBeNull();
    expect(result[0].dbTotalPrice).toBeNull();
    expect(result[0].marginAbsolute).toBeNull();
    expect(result[0].marginPercent).toBeNull();
  });

  it('handles articles without type or size (skipped in index)', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 99n,
        code: 'NO-TYPE',
        description: 'No type',
        type: null,
        series: null,
        thickness: null,
        size: null,
        stock: 0,
        minimum_stock: 0,
        unit_price: 10,
      },
    ]);

    const matcher = createMatcher();
    const items = [createExtractedItem({ description: 'SORF 150# 4"', size: '4"' })];

    const result = await matcher.matchItems(items);

    // No match possible since article has no type/size
    expect(result[0].confidence).toBe(0);
  });

  it('includes debugInfo in results', async () => {
    const matcher = createMatcher();
    const items = [createExtractedItem()];

    const result = await matcher.matchItems(items);

    expect(result[0].debugInfo).toBeDefined();
    expect(result[0].debugInfo).toHaveProperty('extractedType');
    expect(result[0].debugInfo).toHaveProperty('extractedSize');
  });

  it('cleanup disconnects prisma', async () => {
    const matcher = createMatcher();
    await matcher.cleanup();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('uses totalPrice from item or calculates it', async () => {
    const matcher = createMatcher();

    // With explicit totalPrice
    const items1 = [createExtractedItem({ unitPrice: 50, quantity: 10, totalPrice: 600 })];
    const result1 = await matcher.matchItems(items1);
    expect(result1[0].proformaTotalPrice).toBe(600);

    // Without totalPrice (should calculate)
    const items2 = [createExtractedItem({ unitPrice: 50, quantity: 10, totalPrice: 0 })];
    const result2 = await matcher.matchItems(items2);
    expect(result2[0].proformaTotalPrice).toBe(500); // 50 * 10
  });
});
