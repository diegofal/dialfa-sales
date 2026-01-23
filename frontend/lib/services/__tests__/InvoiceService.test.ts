import { NextRequest } from 'next/server';
import { getById, list, remove, cancel, updateExchangeRate } from '../InvoiceService';

// Mock dependencies
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockCount = jest.fn();
const mockUpdate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: {
    invoices: {
      get findMany() {
        return mockFindMany;
      },
      get findUnique() {
        return mockFindUnique;
      },
      get count() {
        return mockCount;
      },
      get update() {
        return mockUpdate;
      },
    },
    sales_orders: {
      get findUnique() {
        return jest.fn();
      },
      get update() {
        return jest.fn();
      },
    },
    stock_movements: {
      get findMany() {
        return jest.fn().mockResolvedValue([]);
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

jest.mock('@/lib/print-templates/template-loader', () => ({
  loadTemplate: jest.fn().mockResolvedValue({ pageSize: 'A4' }),
}));

jest.mock('@/lib/services/PDFService', () => ({
  pdfService: {
    generateInvoicePDF: jest.fn().mockResolvedValue(Buffer.from('pdf')),
  },
}));

jest.mock('@/lib/utils/mapper', () => ({
  mapInvoiceToDTO: jest.fn((i) => ({
    id: i.id.toString(),
    invoiceNumber: i.invoice_number,
    isPrinted: i.is_printed,
    isCancelled: i.is_cancelled,
    totalAmount: Number(i.total_amount || 0),
  })),
}));

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/invoices', {
    headers: new Headers({ 'x-user-id': '1', 'x-user-name': 'admin' }),
  });
}

const mockInvoice = {
  id: 1n,
  invoice_number: 'INV-20240101-0001',
  sales_order_id: 10n,
  invoice_date: new Date('2024-01-01'),
  payment_term_id: 1,
  net_amount: 1000.0,
  tax_amount: 210.0,
  total_amount: 1210.0,
  usd_exchange_rate: 1000.0,
  is_printed: false,
  is_cancelled: false,
  is_credit_note: false,
  is_quotation: false,
  notes: null,
  deleted_at: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  cancelled_at: null,
  printed_at: null,
  cancellation_reason: null,
  invoice_items: [
    {
      id: 1n,
      article_id: 5n,
      article_code: 'ART-005',
      article_description: 'Test Item',
      quantity: 10,
      unit_price_usd: 100,
      unit_price_ars: 100000,
      discount_percent: 0,
      line_total: 1000000,
    },
  ],
  sales_orders: {
    id: 10n,
    order_number: 'SO-001',
    client_id: 1n,
    clients: { business_name: 'Test Client', tax_conditions: { name: 'RI' } },
    sales_order_items: [{ article_id: 5n, quantity: 10 }],
  },
  payment_terms: { id: 1, name: 'Contado' },
};

describe('getById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns mapped invoice when found', async () => {
    mockFindUnique.mockResolvedValue(mockInvoice);

    const result = await getById(1n);

    expect(result).not.toBeNull();
    expect(result?.invoiceNumber).toBe('INV-20240101-0001');
  });

  it('returns null when not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getById(999n);
    expect(result).toBeNull();
  });

  it('returns null when soft-deleted', async () => {
    mockFindUnique.mockResolvedValue({ ...mockInvoice, deleted_at: new Date() });
    const result = await getById(1n);
    expect(result).toBeNull();
  });
});

describe('list', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns paginated invoices', async () => {
    mockFindMany.mockResolvedValue([mockInvoice]);
    mockCount.mockResolvedValue(1);

    const result = await list({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('filters by search term', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await list({ page: 1, limit: 10, search: 'INV-001' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ invoice_number: { contains: 'INV-001', mode: 'insensitive' } }],
        }),
      })
    );
  });

  it('filters by cancelled status', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await list({ page: 1, limit: 10, isCancelled: 'true' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ is_cancelled: true }),
      })
    );
  });
});

describe('remove', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when invoice not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await remove(999n, createMockRequest());

    expect(result.status).toBe(404);
    expect(result.error).toBe('Invoice not found');
  });

  it('returns 400 when invoice is printed', async () => {
    mockFindUnique.mockResolvedValue({ ...mockInvoice, is_printed: true });

    const result = await remove(1n, createMockRequest());

    expect(result.status).toBe(400);
    expect(result.error).toBe('Cannot delete printed invoices');
  });

  it('returns 400 when invoice is cancelled', async () => {
    mockFindUnique.mockResolvedValue({ ...mockInvoice, is_cancelled: true });

    const result = await remove(1n, createMockRequest());

    expect(result.status).toBe(400);
    expect(result.error).toBe('Cannot delete cancelled invoices');
  });

  it('soft-deletes the invoice', async () => {
    mockFindUnique.mockResolvedValue(mockInvoice);
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        invoices: { update: jest.fn() },
        sales_orders: {
          findUnique: jest.fn().mockResolvedValue({ invoices: [] }),
          update: jest.fn(),
        },
      };
      return cb(tx);
    });

    const result = await remove(1n, createMockRequest());

    expect(result.status).toBe(200);
  });
});

describe('cancel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when invoice not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await cancel(999n, createMockRequest());

    expect(result.status).toBe(404);
  });

  it('returns 400 when already cancelled', async () => {
    mockFindUnique.mockResolvedValue({ ...mockInvoice, is_cancelled: true });

    const result = await cancel(1n, createMockRequest());

    expect(result.status).toBe(400);
    expect(result.error).toBe('Invoice is already cancelled');
  });

  it('cancels invoice and restores stock if printed', async () => {
    mockFindUnique.mockResolvedValue({ ...mockInvoice, is_printed: true });
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        sales_orders: {
          findUnique: jest.fn().mockResolvedValue({
            sales_order_items: [{ article_id: 5n, quantity: 10 }],
            invoices: [],
          }),
          update: jest.fn(),
        },
        stock_movements: { create: jest.fn() },
        articles: { update: jest.fn() },
        invoices: { update: jest.fn() },
      };
      return cb(tx);
    });

    const result = await cancel(1n, createMockRequest());

    expect(result.status).toBe(200);
  });
});

describe('updateExchangeRate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 when invoice not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await updateExchangeRate(999n, 1200, createMockRequest());

    expect(result.status).toBe(404);
  });

  it('returns 400 when invoice is printed', async () => {
    mockFindUnique.mockResolvedValue({ ...mockInvoice, is_printed: true });

    const result = await updateExchangeRate(1n, 1200, createMockRequest());

    expect(result.status).toBe(400);
    expect(result.error).toBe('Cannot edit printed invoices');
  });

  it('returns 400 when invoice is cancelled', async () => {
    mockFindUnique.mockResolvedValue({ ...mockInvoice, is_cancelled: true });

    const result = await updateExchangeRate(1n, 1200, createMockRequest());

    expect(result.status).toBe(400);
    expect(result.error).toBe('Cannot edit cancelled invoices');
  });

  it('recalculates amounts with new exchange rate', async () => {
    mockFindUnique.mockResolvedValue(mockInvoice);

    const updatedInvoice = {
      ...mockInvoice,
      usd_exchange_rate: 1200,
      net_amount: 1200000,
      tax_amount: 252000,
      total_amount: 1452000,
      invoice_items: [
        {
          ...mockInvoice.invoice_items[0],
          unit_price_ars: 120000,
          line_total: 1200000,
        },
      ],
    };

    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        invoice_items: { update: jest.fn() },
        invoices: { update: jest.fn().mockResolvedValue(updatedInvoice) },
      };
      return cb(tx);
    });

    const result = await updateExchangeRate(1n, 1200, createMockRequest());

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  });
});
