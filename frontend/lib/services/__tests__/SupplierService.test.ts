import { NextRequest } from 'next/server';
import { list, getById, create, update, remove } from '../SupplierService';

// Mock dependencies
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    suppliers: {
      get findMany() {
        return mockFindMany;
      },
      get findUnique() {
        return mockFindUnique;
      },
      get findFirst() {
        return mockFindFirst;
      },
      get create() {
        return mockCreate;
      },
      get update() {
        return mockUpdate;
      },
    },
  },
  Prisma: {},
}));

jest.mock('@/lib/services/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(1n),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/suppliers', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockSupplier = {
  id: 1,
  code: 'SUP001',
  name: 'Bestflow',
  contact_name: 'John',
  email: 'john@bestflow.com',
  phone: '+1234567890',
  address: '123 Industrial Ave',
  notes: 'Primary supplier',
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-06-01'),
  deleted_at: null,
  created_by: 1,
  updated_by: 1,
};

describe('list', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all suppliers mapped to DTOs', async () => {
    mockFindMany.mockResolvedValue([mockSupplier]);

    const result = await list({});

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bestflow');
    expect(result[0].contactName).toBe('John');
  });

  it('filters by active only when specified', async () => {
    mockFindMany.mockResolvedValue([]);

    await list({ activeOnly: true });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ is_active: true, deleted_at: null }),
      })
    );
  });

  it('applies search filter', async () => {
    mockFindMany.mockResolvedValue([]);

    await list({ searchTerm: 'best' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { code: { contains: 'best', mode: 'insensitive' } },
            { name: { contains: 'best', mode: 'insensitive' } },
          ]),
        }),
      })
    );
  });
});

describe('getById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns supplier DTO when found', async () => {
    mockFindUnique.mockResolvedValue(mockSupplier);

    const result = await getById(1);

    expect(result).not.toBeNull();
    expect(result?.code).toBe('SUP001');
  });

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getById(999);
    expect(result).toBeNull();
  });
});

describe('create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns error when code already exists', async () => {
    mockFindFirst.mockResolvedValue(mockSupplier);

    const result = await create({ code: 'SUP001', name: 'New Supplier' }, 1, createMockRequest());

    expect(result.status).toBe(400);
    expect(result.error).toContain('Ya existe');
  });

  it('uppercases the code', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockSupplier);

    await create({ code: 'sup002', name: 'New' }, 1, createMockRequest());

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: 'SUP002' }),
    });
  });

  it('returns 201 on success', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockSupplier);

    const result = await create({ code: 'NEW', name: 'New Supplier' }, 1, createMockRequest());

    expect(result.status).toBe(201);
    expect(result.data?.name).toBe('Bestflow');
  });

  it('defaults isActive to true', async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue(mockSupplier);

    await create({ code: 'NEW', name: 'Test' }, 1, createMockRequest());

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ is_active: true }),
    });
  });
});

describe('update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when supplier not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await update(999, { name: 'Updated' }, 1, createMockRequest());
    expect(result).toBeNull();
  });

  it('checks for duplicate code when changing code', async () => {
    mockFindUnique.mockResolvedValue(mockSupplier);
    mockFindFirst.mockResolvedValue({ id: 2, code: 'EXISTING' });

    const result = await update(1, { code: 'existing' }, 1, createMockRequest());

    expect(result?.status).toBe(400);
    expect(result?.error).toContain('Ya existe');
  });

  it('allows same code (no change)', async () => {
    mockFindUnique.mockResolvedValue(mockSupplier);
    mockUpdate.mockResolvedValue({ ...mockSupplier, name: 'Updated' });

    const result = await update(1, { code: 'SUP001', name: 'Updated' }, 1, createMockRequest());

    expect(result?.status).toBe(200);
  });

  it('returns 200 on success', async () => {
    mockFindUnique.mockResolvedValue(mockSupplier);
    mockUpdate.mockResolvedValue({ ...mockSupplier, name: 'Updated Name' });

    const result = await update(1, { name: 'Updated Name' }, 1, createMockRequest());

    expect(result?.status).toBe(200);
    expect(result?.data?.name).toBe('Updated Name');
  });
});

describe('remove', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when supplier not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await remove(999, 1, createMockRequest());
    expect(result).toBeNull();
  });

  it('soft-deletes by setting deleted_at and is_active=false', async () => {
    mockFindUnique.mockResolvedValue(mockSupplier);
    mockUpdate.mockResolvedValue({ ...mockSupplier, deleted_at: new Date() });

    await remove(1, 1, createMockRequest());

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        deleted_at: expect.any(Date),
        is_active: false,
        updated_by: 1,
      }),
    });
  });

  it('returns true on success', async () => {
    mockFindUnique.mockResolvedValue(mockSupplier);
    mockUpdate.mockResolvedValue({ ...mockSupplier, deleted_at: new Date() });

    const result = await remove(1, 1, createMockRequest());
    expect(result).toBe(true);
  });
});
