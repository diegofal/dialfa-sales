import { NextRequest } from 'next/server';
import { getById, create } from '../ClientService';

// Mock dependencies
const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockFindUnique = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    clients: {
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

jest.mock('@/lib/services/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(1n),
}));

jest.mock('@/lib/services/changeTracker', () => ({
  ChangeTracker: jest.fn().mockImplementation(() => ({
    trackBefore: jest.fn().mockResolvedValue(undefined),
    trackAfter: jest.fn().mockResolvedValue(undefined),
    trackCreate: jest.fn(),
    trackDelete: jest.fn(),
    saveChanges: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/lib/services/clientClassification', () => ({
  calculateClientClassification: jest.fn().mockResolvedValue({
    byStatus: {
      active: { clients: [] },
      slow_moving: { clients: [] },
      inactive: { clients: [] },
      never_purchased: { clients: [] },
    },
  }),
  getClientClassificationCacheInfo: jest.fn(),
}));

jest.mock('@/lib/services/clientSalesTrends', () => ({
  calculateClientSalesTrends: jest.fn().mockResolvedValue({ data: new Map(), labels: [] }),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/clients', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockClient = {
  id: 10n,
  code: 'CLI-010',
  business_name: 'Test Corp',
  cuit: '20-12345678-9',
  tax_condition_id: 1,
  address: '123 Main St',
  city: 'Buenos Aires',
  postal_code: '1000',
  province_id: 1,
  phone: '+541100001111',
  email: 'test@corp.com',
  operation_type_id: 1,
  transporter_id: null,
  seller_id: null,
  credit_limit: '50000.00',
  payment_term_id: 1,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-06-01'),
  deleted_at: null,
  tax_conditions: { id: 1, name: 'Responsable Inscripto' },
  provinces: { id: 1, name: 'Buenos Aires' },
  operation_types: { id: 1, name: 'Venta' },
  transporters: null,
  payment_terms: { id: 1, code: 'CONTADO', name: 'Contado' },
  client_discounts: [],
};

describe('getById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns mapped client when found', async () => {
    mockFindUnique.mockResolvedValue(mockClient);

    const result = await getById(10n);

    expect(result).not.toBeNull();
    expect(result?.client_discounts).toEqual([]);
  });

  it('returns null when client not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getById(999n);
    expect(result).toBeNull();
  });

  it('returns null when client is soft-deleted', async () => {
    mockFindUnique.mockResolvedValue({ ...mockClient, deleted_at: new Date() });
    const result = await getById(10n);
    expect(result).toBeNull();
  });

  it('maps client discounts with category info', async () => {
    const clientWithDiscounts = {
      ...mockClient,
      client_discounts: [
        {
          id: 1n,
          client_id: 10n,
          category_id: 5n,
          discount_percent: '15.00',
          categories: { id: 5n, name: 'Bridas', code: 'BRI' },
        },
      ],
    };
    mockFindUnique.mockResolvedValue(clientWithDiscounts);

    const result = await getById(10n);

    expect(result?.client_discounts).toHaveLength(1);
    expect(result?.client_discounts[0].category_id).toBe('5');
    expect(result?.client_discounts[0].categories.name).toBe('Bridas');
  });
});

describe('create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates client with mapped field names', async () => {
    mockCreate.mockResolvedValue(mockClient);

    await create(
      {
        code: 'CLI-020',
        businessName: 'New Corp',
        cuit: '20-87654321-0',
        taxConditionId: 1,
        address: '456 Oak St',
        city: 'Córdoba',
        postalCode: '5000',
        provinceId: 2,
        phone: '+5435100001111',
        operationTypeId: 1,
      },
      createMockRequest()
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'CLI-020',
        business_name: 'New Corp',
        cuit: '20-87654321-0',
        tax_condition_id: 1,
      }),
      include: expect.any(Object),
    });
  });

  it('defaults paymentTermId to 1 when not provided', async () => {
    mockCreate.mockResolvedValue(mockClient);

    await create(
      {
        code: 'NEW',
        businessName: 'Test',
        cuit: '20-00000000-0',
        taxConditionId: 1,
        address: 'X',
        city: 'Y',
        postalCode: '1000',
        provinceId: 1,
        phone: '123',
        operationTypeId: 1,
      },
      createMockRequest()
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ payment_term_id: 1 }),
      include: expect.any(Object),
    });
  });

  it('uses provided paymentTermId', async () => {
    mockCreate.mockResolvedValue(mockClient);

    await create(
      {
        code: 'NEW',
        businessName: 'Test',
        cuit: '20-00000000-0',
        taxConditionId: 1,
        address: 'X',
        city: 'Y',
        postalCode: '1000',
        provinceId: 1,
        phone: '123',
        operationTypeId: 1,
        paymentTermId: 3,
      },
      createMockRequest()
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ payment_term_id: 3 }),
      include: expect.any(Object),
    });
  });
});
