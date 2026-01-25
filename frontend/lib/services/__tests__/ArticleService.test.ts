import { NextRequest } from 'next/server';
import { getById, create, remove, listStockMovements, adjustStock } from '../ArticleService';

// Mock dependencies
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockTransaction = jest.fn();
const mockStockMovementsFindMany = jest.fn();
const mockStockMovementsCount = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: {
    articles: {
      get findMany() {
        return mockFindMany;
      },
      get findUnique() {
        return mockFindUnique;
      },
      get findFirst() {
        return mockFindFirst;
      },
      get count() {
        return mockCount;
      },
      get create() {
        return mockCreate;
      },
      get update() {
        return mockUpdate;
      },
    },
    stock_movements: {
      get findMany() {
        return mockStockMovementsFindMany;
      },
      get count() {
        return mockStockMovementsCount;
      },
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/lib/utils/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(1n),
}));

jest.mock('@/lib/utils/changeTracker', () => ({
  ChangeTracker: jest.fn().mockImplementation(() => ({
    trackBefore: jest.fn().mockResolvedValue(undefined),
    trackAfter: jest.fn().mockResolvedValue(undefined),
    trackCreate: jest.fn(),
    trackDelete: jest.fn(),
    saveChanges: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/lib/utils/articles/abcClassification', () => ({
  calculateABCClassification: jest.fn().mockResolvedValue(new Map()),
  refreshABCClassification: jest.fn().mockResolvedValue(undefined),
  getABCCacheInfo: jest.fn().mockReturnValue({ isCached: false }),
}));

jest.mock('@/lib/utils/articles/salesTrends', () => ({
  calculateSalesTrends: jest.fn().mockResolvedValue({ data: new Map(), labels: [] }),
  calculateLastSaleDates: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('@/lib/utils/articles/stockValuation', () => ({
  calculateStockValuation: jest.fn().mockResolvedValue({ byStatus: {} }),
  getStockValuationCacheInfo: jest.fn().mockReturnValue({ isCached: false }),
}));

jest.mock('@/lib/utils/mapper', () => ({
  mapArticleToDTO: jest.fn((a) => ({
    id: a.id.toString(),
    code: a.code,
    description: a.description,
    categoryId: a.category_id?.toString(),
    categoryName: a.categories?.name || '',
    stock: Number(a.stock),
    minimumStock: Number(a.minimum_stock),
    unitPrice: Number(a.unit_price),
    displayOrder: a.display_order,
  })),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/articles', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockArticle = {
  id: 1n,
  code: 'ART-001',
  description: 'Test Article',
  category_id: 5n,
  unit_price: 100.5,
  cost_price: 50.0,
  stock: 20,
  minimum_stock: 5,
  display_order: '001',
  is_discontinued: false,
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-06-01'),
  deleted_at: null,
  categories: { name: 'Bridas', default_discount_percent: 10 },
};

describe('getById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns mapped article when found', async () => {
    mockFindUnique.mockResolvedValue(mockArticle);

    const result = await getById(1n);

    expect(result).not.toBeNull();
    expect(result?.code).toBe('ART-001');
  });

  it('returns null when article not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getById(999n);
    expect(result).toBeNull();
  });

  it('returns null when article is soft-deleted', async () => {
    mockFindUnique.mockResolvedValue({ ...mockArticle, deleted_at: new Date() });
    const result = await getById(1n);
    expect(result).toBeNull();
  });
});

describe('create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates article with mapped fields', async () => {
    mockCreate.mockResolvedValue(mockArticle);

    await create(
      {
        code: 'ART-002',
        description: 'New Article',
        categoryId: 5n,
        unitPrice: 200,
        costPrice: 100,
        stock: 10,
        minimumStock: 2,
      },
      createMockRequest()
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'ART-002',
        description: 'New Article',
        category_id: 5n,
        unit_price: 200,
        cost_price: 100,
      }),
      include: { categories: true },
    });
  });

  it('defaults stock to 0 when not provided', async () => {
    mockCreate.mockResolvedValue(mockArticle);

    await create(
      {
        code: 'ART-003',
        description: 'No Stock',
        categoryId: 5n,
        unitPrice: 50,
      },
      createMockRequest()
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stock: 0,
        minimum_stock: 0,
      }),
      include: { categories: true },
    });
  });
});

describe('remove', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when article not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await remove(999n, createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when article already deleted', async () => {
    mockFindUnique.mockResolvedValue({ ...mockArticle, deleted_at: new Date() });
    const result = await remove(1n, createMockRequest());
    expect(result).toBeNull();
  });

  it('soft-deletes the article', async () => {
    mockFindUnique.mockResolvedValue(mockArticle);
    mockUpdate.mockResolvedValue({ ...mockArticle, deleted_at: new Date() });

    const result = await remove(1n, createMockRequest());

    expect(result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1n },
      data: expect.objectContaining({
        deleted_at: expect.any(Date),
      }),
    });
  });
});

describe('listStockMovements', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated stock movements', async () => {
    const mockMovements = [
      {
        id: 1n,
        article_id: 1n,
        movement_type: 2,
        quantity: 5,
        reference_document: 'INV-001',
        movement_date: new Date('2024-06-01'),
        notes: 'Sale',
        created_at: new Date('2024-06-01'),
        articles: { code: 'ART-001', description: 'Test Article' },
      },
    ];
    mockStockMovementsCount.mockResolvedValue(1);
    mockStockMovementsFindMany.mockResolvedValue(mockMovements);

    const result = await listStockMovements({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].movementTypeName).toBe('Venta');
    expect(result.pagination.total).toBe(1);
  });

  it('filters by article ID', async () => {
    mockStockMovementsCount.mockResolvedValue(0);
    mockStockMovementsFindMany.mockResolvedValue([]);

    await listStockMovements({ page: 1, limit: 10, articleId: '5' });

    expect(mockStockMovementsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ article_id: 5n }),
      })
    );
  });

  it('filters by date range', async () => {
    mockStockMovementsCount.mockResolvedValue(0);
    mockStockMovementsFindMany.mockResolvedValue([]);

    await listStockMovements({
      page: 1,
      limit: 10,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    });

    expect(mockStockMovementsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          movement_date: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      })
    );
  });
});

describe('adjustStock', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when article not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await adjustStock(
      { articleId: 999, quantity: 5, reason: 'Test' },
      createMockRequest()
    );

    expect(result).toBeNull();
  });

  it('returns null when article is soft-deleted', async () => {
    mockFindUnique.mockResolvedValue({ ...mockArticle, deleted_at: new Date() });

    const result = await adjustStock(
      { articleId: 1, quantity: 5, reason: 'Test' },
      createMockRequest()
    );

    expect(result).toBeNull();
  });

  it('adjusts stock via transaction', async () => {
    mockFindUnique.mockResolvedValue(mockArticle);
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        stock_movements: { create: jest.fn().mockResolvedValue({ id: 1n }) },
        articles: { update: jest.fn().mockResolvedValue({ ...mockArticle, stock: 25 }) },
      };
      return cb(tx);
    });

    const result = await adjustStock(
      { articleId: 1, quantity: 5, reason: 'Restock' },
      createMockRequest()
    );

    expect(result).toEqual({ newStock: 25 });
  });
});
