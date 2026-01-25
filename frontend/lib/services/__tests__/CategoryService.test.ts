import { NextRequest } from 'next/server';
import { list, getById, create, update, remove } from '../CategoryService';

// Mock dependencies
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    categories: {
      get findMany() {
        return mockFindMany;
      },
      get count() {
        return mockCount;
      },
      get findUnique() {
        return mockFindUnique;
      },
      get create() {
        return mockCreate;
      },
      get update() {
        return mockUpdate;
      },
    },
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

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/categories', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockCategory = {
  id: 5n,
  code: 'BRI',
  name: 'Bridas',
  description: 'Bridas y conexiones',
  default_discount_percent: '10.00',
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-06-01'),
  deleted_at: null,
  _count: { articles: 25 },
};

describe('list', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated categories with articles count', async () => {
    mockFindMany.mockResolvedValue([mockCategory]);
    mockCount.mockResolvedValue(1);

    const result = await list({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].articlesCount).toBe(25);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('applies search filter', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await list({ page: 1, limit: 10, search: 'brida' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ code: { contains: 'brida', mode: 'insensitive' } }]),
        }),
      })
    );
  });

  it('filters by isActive', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await list({ page: 1, limit: 10, isActive: 'true' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ is_active: true }),
      })
    );
  });

  it('calculates pagination correctly', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(55);

    const result = await list({ page: 2, limit: 20 });

    expect(result.pagination.totalPages).toBe(3);
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
  });
});

describe('getById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns category when found', async () => {
    mockFindUnique.mockResolvedValue(mockCategory);

    const result = await getById(5n);

    expect(result).not.toBeNull();
    expect(result?.articlesCount).toBe(25);
  });

  it('returns null when category not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getById(999n);
    expect(result).toBeNull();
  });

  it('returns null when category is soft-deleted', async () => {
    mockFindUnique.mockResolvedValue({ ...mockCategory, deleted_at: new Date() });
    const result = await getById(5n);
    expect(result).toBeNull();
  });
});

describe('create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a category with provided data', async () => {
    mockCreate.mockResolvedValue(mockCategory);

    await create(
      {
        code: 'BRI',
        name: 'Bridas',
        description: 'Test',
        defaultDiscountPercent: 10,
        isActive: true,
      },
      createMockRequest()
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'BRI',
        name: 'Bridas',
        description: 'Test',
        default_discount_percent: 10,
        is_active: true,
      }),
    });
  });

  it('defaults isActive to true when not provided', async () => {
    mockCreate.mockResolvedValue(mockCategory);

    await create({ code: 'NEW', name: 'New Cat' }, createMockRequest());

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ is_active: true }),
    });
  });
});

describe('update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when category not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await update(999n, { name: 'Updated' }, createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when category is soft-deleted', async () => {
    mockFindUnique.mockResolvedValue({ ...mockCategory, deleted_at: new Date() });

    const result = await update(5n, { name: 'Updated' }, createMockRequest());
    expect(result).toBeNull();
  });

  it('updates category when found', async () => {
    mockFindUnique.mockResolvedValue(mockCategory);
    mockUpdate.mockResolvedValue({ ...mockCategory, name: 'Updated Bridas' });

    const result = await update(5n, { name: 'Updated Bridas' }, createMockRequest());

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 5n },
      data: expect.objectContaining({ name: 'Updated Bridas' }),
    });
    expect(result).not.toBeNull();
  });
});

describe('remove', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when category not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await remove(999n, createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when category already deleted', async () => {
    mockFindUnique.mockResolvedValue({ ...mockCategory, deleted_at: new Date() });
    const result = await remove(5n, createMockRequest());
    expect(result).toBeNull();
  });

  it('soft-deletes the category', async () => {
    mockFindUnique.mockResolvedValue(mockCategory);
    mockUpdate.mockResolvedValue({ ...mockCategory, deleted_at: new Date() });

    await remove(5n, createMockRequest());

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 5n },
      data: expect.objectContaining({ deleted_at: expect.any(Date) }),
    });
  });

  it('returns true on success', async () => {
    mockFindUnique.mockResolvedValue(mockCategory);
    mockUpdate.mockResolvedValue({ ...mockCategory, deleted_at: new Date() });

    const result = await remove(5n, createMockRequest());
    expect(result).toBe(true);
  });
});
