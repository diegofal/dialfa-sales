import { NextRequest } from 'next/server';
import { create, remove, updateStatus, getById } from '../SupplierOrderService';

// Mock dependencies
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockItemsDeleteMany = jest.fn();
const mockArticlesUpdate = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: {
    supplier_orders: {
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
    supplier_order_items: {
      get deleteMany() {
        return mockItemsDeleteMany;
      },
    },
    articles: {
      get update() {
        return mockArticlesUpdate;
      },
    },
  },
  Prisma: {},
}));

jest.mock('@/lib/utils/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(1n),
}));

jest.mock('@/lib/utils/priceLists/proformaImport/article-matcher', () => ({
  ArticleMatcher: jest.fn(),
}));

jest.mock('@/lib/utils/priceLists/proformaImport/bestflow-extractor', () => ({
  BestflowExtractor: jest.fn(),
}));

jest.mock('@/lib/utils/articles/salesTrends', () => ({
  calculateSalesTrends: jest.fn().mockResolvedValue({ data: new Map(), labels: [] }),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/supplier-orders', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockOrder = {
  id: 1n,
  order_number: 'PO-000001',
  supplier_id: 5,
  status: 'draft',
  order_date: new Date('2024-01-01'),
  expected_delivery_date: null,
  actual_delivery_date: null,
  total_items: 2,
  total_quantity: 20,
  estimated_sale_time_months: 6.5,
  notes: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  created_by: 1,
  updated_by: 1,
  deleted_at: null,
  supplier: { id: 5, name: 'BestFlow' },
  supplier_order_items: [
    {
      id: 1n,
      article_id: 10n,
      article_code: 'ART-010',
      article_description: 'Brida SORF',
      quantity: 10,
      current_stock: 5,
      minimum_stock: 3,
      avg_monthly_sales: 2.5,
      estimated_sale_time: 4.0,
      received_quantity: 0,
      unit_weight: 1.5,
      proforma_unit_price: 50.0,
      proforma_total_price: 500.0,
      db_unit_price: 80.0,
      db_total_price: 800.0,
      margin_absolute: 30.0,
      margin_percent: 60.0,
    },
  ],
};

describe('getById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns mapped order when found', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);

    const result = await getById(1n);

    expect(result).not.toBeNull();
    expect(result?.orderNumber).toBe('PO-000001');
    expect(result?.supplierName).toBe('BestFlow');
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0].articleCode).toBe('ART-010');
  });

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getById(999n);
    expect(result).toBeNull();
  });
});

describe('create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when no items provided', async () => {
    const result = await create({ items: [] }, 1, createMockRequest());

    expect(result.status).toBe(400);
    expect(result.error).toBe('Debe incluir al menos un artículo');
  });

  it('creates order with generated number', async () => {
    mockFindFirst.mockResolvedValue({ id: 5n }); // Last order
    mockCreate.mockResolvedValue({
      ...mockOrder,
      order_number: 'PO-000006',
    });

    const result = await create(
      {
        supplierId: 5,
        items: [
          {
            articleId: 10,
            articleCode: 'ART-010',
            articleDescription: 'Brida SORF',
            quantity: 10,
            currentStock: 5,
            minimumStock: 3,
          },
        ],
      },
      1,
      createMockRequest()
    );

    expect(result.status).toBe(201);
    expect(result.data?.orderNumber).toBe('PO-000006');
  });

  it('calculates weighted sale time', async () => {
    mockFindFirst.mockResolvedValue(null); // No previous orders
    mockCreate.mockResolvedValue({
      ...mockOrder,
      order_number: 'PO-000001',
    });

    await create(
      {
        items: [
          {
            articleId: 1,
            articleCode: 'A',
            articleDescription: 'X',
            quantity: 10,
            currentStock: 0,
            minimumStock: 0,
            estimatedSaleTime: 4,
          },
          {
            articleId: 2,
            articleCode: 'B',
            articleDescription: 'Y',
            quantity: 10,
            currentStock: 0,
            minimumStock: 0,
            estimatedSaleTime: 8,
          },
        ],
      },
      1,
      createMockRequest()
    );

    // Weighted avg: (4*10 + 8*10) / 20 = 6
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estimated_sale_time_months: 6,
        }),
      })
    );
  });
});

describe('remove', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when order not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await remove(999n, 1, createMockRequest());

    expect(result.status).toBe(404);
    expect(result.error).toBe('Pedido no encontrado');
  });

  it('soft-deletes the order', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);
    mockUpdate.mockResolvedValue({ ...mockOrder, deleted_at: new Date() });

    const result = await remove(1n, 1, createMockRequest());

    expect(result.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1n },
      data: expect.objectContaining({
        deleted_at: expect.any(Date),
        updated_by: 1,
      }),
    });
  });
});

describe('updateStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 for invalid status', async () => {
    const result = await updateStatus(1n, 'invalid_status', 1, createMockRequest());

    expect(result.status).toBe(400);
    expect(result.error).toBe('Estado inválido');
  });

  it('updates status to confirmed', async () => {
    mockFindUnique.mockResolvedValue({ status: 'draft', order_number: 'PO-001' });
    mockUpdate.mockResolvedValue({
      ...mockOrder,
      status: 'confirmed',
      order_number: 'PO-000001',
      actual_delivery_date: null,
    });

    const result = await updateStatus(1n, 'confirmed', 1, createMockRequest());

    expect(result.status).toBe(200);
    expect(result.data?.status).toBe('confirmed');
  });

  it('sets actual_delivery_date when status is received', async () => {
    mockFindUnique.mockResolvedValue({ status: 'in_transit', order_number: 'PO-001' });
    mockUpdate.mockResolvedValue({
      ...mockOrder,
      status: 'received',
      order_number: 'PO-000001',
      actual_delivery_date: new Date(),
    });

    await updateStatus(1n, 'received', 1, createMockRequest());

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1n },
      data: expect.objectContaining({
        status: 'received',
        actual_delivery_date: expect.any(Date),
      }),
    });
  });

  it('accepts all valid statuses', async () => {
    const validStatuses = ['draft', 'confirmed', 'sent', 'in_transit', 'received', 'cancelled'];

    for (const status of validStatuses) {
      jest.clearAllMocks();
      mockFindUnique.mockResolvedValue({ status: 'draft', order_number: 'PO-001' });
      mockUpdate.mockResolvedValue({
        ...mockOrder,
        status,
        order_number: 'PO-000001',
        actual_delivery_date: status === 'received' ? new Date() : null,
      });

      const result = await updateStatus(1n, status, 1, createMockRequest());
      expect(result.status).toBe(200);
    }
  });
});
