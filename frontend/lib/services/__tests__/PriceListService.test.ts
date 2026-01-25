import { NextRequest } from 'next/server';
import {
  bulkUpdate,
  revertSingle,
  getDraft,
  saveDraft,
  deleteDraft,
  getHistory,
} from '../PriceListService';

// Mock dependencies
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockPriceHistoryFindMany = jest.fn();
const mockPriceHistoryFindUnique = jest.fn();
const mockPriceHistoryCreate = jest.fn();
const mockPriceHistoryCount = jest.fn();
const mockDraftFindUnique = jest.fn();
const mockDraftUpsert = jest.fn();
const mockDraftDelete = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: {
    articles: {
      get findMany() {
        return mockFindMany;
      },
      get findUnique() {
        return mockFindUnique;
      },
      get update() {
        return mockUpdate;
      },
    },
    price_history: {
      get findMany() {
        return mockPriceHistoryFindMany;
      },
      get findUnique() {
        return mockPriceHistoryFindUnique;
      },
      get create() {
        return mockPriceHistoryCreate;
      },
      get count() {
        return mockPriceHistoryCount;
      },
    },
    price_import_drafts: {
      get findUnique() {
        return mockDraftFindUnique;
      },
      get upsert() {
        return mockDraftUpsert;
      },
      get delete() {
        return mockDraftDelete;
      },
    },
  },
}));

jest.mock('@/lib/utils/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(1n),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/price-lists', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockArticle = {
  id: 1n,
  code: 'ART-001',
  description: 'Test Article',
  unit_price: 100.0,
  deleted_at: null,
  categories: { name: 'Bridas', code: 'BRI' },
};

describe('bulkUpdate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates prices for valid articles', async () => {
    mockFindUnique.mockResolvedValue(mockArticle);
    mockUpdate.mockResolvedValue({ ...mockArticle, unit_price: 150.0 });
    mockPriceHistoryCreate.mockResolvedValue({ id: 1n });

    const result = await bulkUpdate(
      { updates: [{ articleId: 1, newPrice: 150 }] },
      1,
      'admin@test.com',
      createMockRequest()
    );

    expect(result.updatedCount).toBe(1);
    expect(result.changeBatchId).toBeDefined();
    expect(result.articles).toHaveLength(1);
  });

  it('skips deleted articles', async () => {
    mockFindUnique.mockResolvedValue({ ...mockArticle, deleted_at: new Date() });

    const result = await bulkUpdate(
      { updates: [{ articleId: 1, newPrice: 150 }] },
      1,
      'admin@test.com'
    );

    expect(result.updatedCount).toBe(0);
    expect(result.articles).toHaveLength(0);
  });

  it('skips articles not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await bulkUpdate({ updates: [{ articleId: 999, newPrice: 150 }] }, 1, null);

    expect(result.updatedCount).toBe(0);
  });

  it('records price history for each update', async () => {
    mockFindUnique.mockResolvedValue(mockArticle);
    mockUpdate.mockResolvedValue({ ...mockArticle, unit_price: 200.0 });
    mockPriceHistoryCreate.mockResolvedValue({ id: 1n });

    await bulkUpdate(
      { updates: [{ articleId: 1, newPrice: 200 }], changeType: 'csv_import', notes: 'Import' },
      1,
      'admin@test.com'
    );

    expect(mockPriceHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        old_price: 100,
        new_price: 200,
        change_type: 'csv_import',
        notes: 'Import',
      }),
    });
  });
});

describe('revertSingle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when history record not found', async () => {
    mockPriceHistoryFindUnique.mockResolvedValue(null);

    const result = await revertSingle(999);

    expect(result.status).toBe(404);
    expect(result.error).toBe('Price history record not found');
  });

  it('returns 404 when article not found on history', async () => {
    mockPriceHistoryFindUnique.mockResolvedValue({
      id: 1n,
      old_price: 100,
      new_price: 150,
      articles: null,
    });

    const result = await revertSingle(1);

    expect(result.status).toBe(404);
    expect(result.error).toBe('Article not found');
  });

  it('returns 400 when current price does not match history', async () => {
    mockPriceHistoryFindUnique.mockResolvedValue({
      id: 1n,
      old_price: 100,
      new_price: 150,
      change_batch_id: 'batch-1',
      change_type: 'manual',
      articles: { id: 1n, code: 'ART-001', unit_price: 200 }, // Current is 200, not 150
    });

    const result = await revertSingle(1);

    expect(result.status).toBe(400);
  });

  it('reverts price and creates history record', async () => {
    mockPriceHistoryFindUnique.mockResolvedValue({
      id: 1n,
      old_price: 100,
      new_price: 150,
      change_batch_id: 'batch-1',
      change_type: 'manual',
      articles: { id: 1n, code: 'ART-001', unit_price: 150 },
    });
    mockUpdate.mockResolvedValue({});
    mockPriceHistoryCreate.mockResolvedValue({ id: 2n });

    const result = await revertSingle(1, 1, 'admin@test.com', createMockRequest());

    expect(result.status).toBe(200);
    expect(result.data?.oldPrice).toBe(150);
    expect(result.data?.newPrice).toBe(100);
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockPriceHistoryCreate).toHaveBeenCalled();
  });
});

describe('getDraft', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when no draft exists', async () => {
    mockDraftFindUnique.mockResolvedValue(null);

    const result = await getDraft(1);

    expect(result).toBeNull();
  });

  it('returns draft data when exists', async () => {
    mockDraftFindUnique.mockResolvedValue({
      id: 1n,
      user_id: 1,
      draft_data: { '1': 150, '2': 200 },
      article_count: 2,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    });

    const result = await getDraft(1);

    expect(result).not.toBeNull();
    expect(result?.articleCount).toBe(2);
    expect(result?.draftData).toEqual({ '1': 150, '2': 200 });
  });
});

describe('saveDraft', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts draft with article count', async () => {
    mockDraftUpsert.mockResolvedValue({ id: 1n, article_count: 3 });

    const result = await saveDraft(1, { '1': 100, '2': 200, '3': 300 });

    expect(result.articleCount).toBe(3);
    expect(mockDraftUpsert).toHaveBeenCalledWith({
      where: { user_id: 1 },
      create: expect.objectContaining({
        user_id: 1,
        article_count: 3,
      }),
      update: expect.objectContaining({
        article_count: 3,
      }),
    });
  });
});

describe('deleteDraft', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes draft by user ID', async () => {
    mockDraftDelete.mockResolvedValue({});

    await deleteDraft(1);

    expect(mockDraftDelete).toHaveBeenCalledWith({
      where: { user_id: 1 },
    });
  });

  it('does not throw when draft does not exist', async () => {
    mockDraftDelete.mockRejectedValue(new Error('Not found'));

    await expect(deleteDraft(999)).resolves.toBeUndefined();
  });
});

describe('getHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated price history', async () => {
    const mockHistory = [
      {
        id: 1n,
        article_id: 1n,
        old_price: 100,
        new_price: 150,
        change_type: 'manual',
        change_batch_id: null,
        changed_by: 1,
        changed_by_name: 'admin',
        notes: 'Price increase',
        created_at: new Date('2024-06-01'),
        articles: { id: 1n, code: 'ART-001', description: 'Test', category_id: 5n },
      },
    ];
    mockPriceHistoryFindMany.mockResolvedValue(mockHistory);
    mockPriceHistoryCount.mockResolvedValue(1);

    const result = await getHistory({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].priceChange).toBe(50);
    expect(result.data[0].priceChangePercent).toBe(50);
    expect(result.pagination.total).toBe(1);
  });

  it('filters by article ID', async () => {
    mockPriceHistoryFindMany.mockResolvedValue([]);
    mockPriceHistoryCount.mockResolvedValue(0);

    await getHistory({ page: 1, limit: 10, articleId: '5' });

    expect(mockPriceHistoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ article_id: 5n }),
      })
    );
  });

  it('filters by change type', async () => {
    mockPriceHistoryFindMany.mockResolvedValue([]);
    mockPriceHistoryCount.mockResolvedValue(0);

    await getHistory({ page: 1, limit: 10, changeType: 'csv_import' });

    expect(mockPriceHistoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ change_type: 'csv_import' }),
      })
    );
  });
});
