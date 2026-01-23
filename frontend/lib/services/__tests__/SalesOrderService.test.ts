import { NextRequest } from 'next/server';
import { getById, create, remove, getPermissions } from '../SalesOrderService';

// Mock dependencies
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: {
    sales_orders: {
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
    sales_order_items: {
      get createMany() {
        return jest.fn();
      },
      get deleteMany() {
        return jest.fn();
      },
    },
    invoices: {
      get count() {
        return jest.fn().mockResolvedValue(0);
      },
    },
    delivery_notes: {
      get count() {
        return jest.fn().mockResolvedValue(0);
      },
    },
    system_settings: {
      get findUnique() {
        return jest.fn();
      },
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
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

jest.mock('@/lib/utils/mapper', () => ({
  mapSalesOrderToDTO: jest.fn((o) => ({
    id: o.id.toString(),
    orderNumber: o.order_number,
    clientId: o.client_id?.toString(),
    clientBusinessName: o.clients?.business_name,
    status: o.status,
    total: Number(o.total),
    items:
      o.sales_order_items?.map((i: { article_id: bigint; quantity: number }) => ({
        articleId: i.article_id.toString(),
        quantity: i.quantity,
      })) || [],
  })),
  mapInvoiceToDTO: jest.fn((i) => ({ id: i.id.toString() })),
}));

jest.mock('@/types/permissions', () => ({
  calculateSalesOrderPermissions: jest.fn((status) => ({
    canEdit: !status.invoicePrinted,
    canDelete: true,
    canGenerateInvoice: !status.hasInvoice,
    canGenerateDeliveryNote: !status.hasDeliveryNote,
  })),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/sales-orders', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockOrder = {
  id: 1n,
  order_number: 'SO-20240101-0001',
  client_id: 10n,
  order_date: new Date('2024-01-01'),
  status: 'PENDING',
  total: 5000.0,
  special_discount_percent: 0,
  payment_term_id: 1,
  notes: null,
  deleted_at: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  clients: { id: 10n, business_name: 'Test Client' },
  payment_terms: { id: 1, code: 'CONTADO', name: 'Contado' },
  sales_order_items: [
    {
      id: 1n,
      article_id: 5n,
      quantity: 10,
      unit_price: 500,
      discount_percent: 0,
      line_total: 5000,
      articles: { id: 5n, code: 'ART-005', description: 'Item 1' },
    },
  ],
  invoices: [],
  delivery_notes: [],
};

describe('getById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns mapped sales order when found', async () => {
    mockFindUnique.mockResolvedValue(mockOrder);

    const result = await getById(1n);

    expect(result).not.toBeNull();
    expect(result?.orderNumber).toBe('SO-20240101-0001');
    expect(result?.status).toBe('PENDING');
  });

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getById(999n);
    expect(result).toBeNull();
  });

  it('returns null when soft-deleted', async () => {
    mockFindUnique.mockResolvedValue({ ...mockOrder, deleted_at: new Date() });
    const result = await getById(1n);
    expect(result).toBeNull();
  });
});

describe('create', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates sales order via transaction', async () => {
    const createdOrder = { ...mockOrder, order_number: 'SO-20240601-0001' };
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        sales_orders: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(createdOrder),
          findUnique: jest.fn().mockResolvedValue(createdOrder),
        },
        sales_order_items: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return cb(tx);
    });

    const result = await create(
      {
        clientId: 10n,
        items: [{ articleId: 5n, quantity: 10, unitPrice: 500, discountPercent: 0 }],
        specialDiscountPercent: 0,
      },
      createMockRequest()
    );

    expect(result).not.toBeNull();
    expect(result.orderNumber).toBe('SO-20240601-0001');
  });

  it('throws when transaction returns null', async () => {
    mockTransaction.mockResolvedValue(null);

    await expect(
      create(
        {
          clientId: 10n,
          items: [{ articleId: 5n, quantity: 10, unitPrice: 500, discountPercent: 0 }],
          specialDiscountPercent: 0,
        },
        createMockRequest()
      )
    ).rejects.toThrow('Failed to create sales order');
  });
});

describe('remove', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when order not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await remove(999n, createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when order is soft-deleted', async () => {
    mockFindUnique.mockResolvedValue({ ...mockOrder, deleted_at: new Date() });
    const result = await remove(1n, createMockRequest());
    expect(result).toBeNull();
  });

  it('deletes order and returns affected documents', async () => {
    const orderWithInvoices = {
      ...mockOrder,
      invoices: [{ id: 100n, invoice_number: 'INV-001', is_printed: false, is_cancelled: false }],
      delivery_notes: [{ id: 200n, delivery_number: 'REM-001' }],
    };
    mockFindUnique.mockResolvedValue(orderWithInvoices);
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        invoices: { update: jest.fn() },
        delivery_notes: { update: jest.fn() },
        sales_order_items: { deleteMany: jest.fn() },
        sales_orders: { update: jest.fn() },
      };
      return cb(tx);
    });

    const result = await remove(1n, createMockRequest());

    expect(result).not.toBeNull();
    expect(result!.orderNumber).toBe('SO-20240101-0001');
    expect(result!.affectedInvoices).toHaveLength(1);
    expect(result!.affectedDeliveryNotes).toHaveLength(1);
  });
});

describe('getPermissions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when order not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getPermissions(999n);
    expect(result).toBeNull();
  });

  it('returns null when order is soft-deleted', async () => {
    mockFindUnique.mockResolvedValue({ ...mockOrder, deleted_at: new Date() });
    const result = await getPermissions(1n);
    expect(result).toBeNull();
  });

  it('returns permissions for order without invoice', async () => {
    mockFindUnique.mockResolvedValue({
      ...mockOrder,
      invoices: [],
      delivery_notes: [],
    });

    const result = await getPermissions(1n);

    expect(result).not.toBeNull();
    expect(result!.status.hasInvoice).toBe(false);
    expect(result!.permissions.canGenerateInvoice).toBe(true);
  });

  it('returns permissions for order with printed invoice', async () => {
    mockFindUnique.mockResolvedValue({
      ...mockOrder,
      invoices: [{ id: 1n, invoice_number: 'INV-001', is_printed: true, is_cancelled: false }],
      delivery_notes: [],
    });

    const result = await getPermissions(1n);

    expect(result).not.toBeNull();
    expect(result!.status.hasInvoice).toBe(true);
    expect(result!.status.invoicePrinted).toBe(true);
    expect(result!.permissions.canEdit).toBe(false);
  });
});
