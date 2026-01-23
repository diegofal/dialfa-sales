import {
  mapArticleToDTO,
  mapCategoryToDTO,
  mapClientToDTO,
  mapSalesOrderToDTO,
  mapInvoiceToDTO,
  mapDeliveryNoteToDTO,
} from '../mapper';

describe('mapArticleToDTO', () => {
  const baseArticle = {
    id: 42n,
    code: 'ART-001',
    description: 'Test Article',
    category_id: 5n,
    categories: { name: 'Bridas' },
    unit_price: '150.5000',
    stock: '100.000',
    minimum_stock: '10.000',
    location: 'A-1',
    is_discontinued: false,
    notes: null,
    cost_price: '80.5000',
    display_order: 1,
    historical_price1: '120.0000',
    series: null,
    size: '1/2',
    supplier_id: null,
    thickness: '3/4',
    type: 'Ciega',
    weight_kg: '2.5',
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-06-01'),
  };

  it('converts BigInt id to number', () => {
    const result = mapArticleToDTO(baseArticle);
    expect(result.id).toBe(42);
    expect(typeof result.id).toBe('number');
  });

  it('converts BigInt category_id to number', () => {
    const result = mapArticleToDTO(baseArticle);
    expect(result.categoryId).toBe(5);
  });

  it('extracts category name from nested relation', () => {
    const result = mapArticleToDTO(baseArticle);
    expect(result.categoryName).toBe('Bridas');
  });

  it('handles missing category gracefully', () => {
    const withoutCategory = { ...baseArticle, categories: undefined };
    const result = mapArticleToDTO(withoutCategory);
    expect(result.categoryName).toBe('');
  });

  it('parses Decimal string prices to floats', () => {
    const result = mapArticleToDTO(baseArticle);
    expect(result.unitPrice).toBe(150.5);
    expect(result.costPrice).toBe(80.5);
    expect(result.stock).toBe(100);
    expect(result.minimumStock).toBe(10);
  });

  it('handles null optional fields', () => {
    const result = mapArticleToDTO(baseArticle);
    expect(result.notes).toBeNull();
    expect(result.supplierId).toBeNull();
    expect(result.series).toBeNull();
  });

  it('handles null cost_price', () => {
    const noCost = { ...baseArticle, cost_price: null };
    const result = mapArticleToDTO(noCost);
    expect(result.costPrice).toBeNull();
  });

  it('preserves boolean fields', () => {
    const result = mapArticleToDTO(baseArticle);
    expect(result.isDiscontinued).toBe(false);
    expect(result.isActive).toBe(true);
  });

  it('parses weight_kg from string', () => {
    const result = mapArticleToDTO(baseArticle);
    expect(result.weightKg).toBe(2.5);
  });
});

describe('mapCategoryToDTO', () => {
  it('maps all fields correctly', () => {
    const category = {
      id: 3n,
      code: 'BRI',
      name: 'Bridas',
      description: 'Bridas de acero',
      default_discount_percent: '15.50',
      is_active: true,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    };

    const result = mapCategoryToDTO(category);
    expect(result.id).toBe(3);
    expect(result.code).toBe('BRI');
    expect(result.name).toBe('Bridas');
    expect(result.description).toBe('Bridas de acero');
    expect(result.defaultDiscountPercent).toBe(15.5);
    expect(result.isActive).toBe(true);
  });
});

describe('mapClientToDTO', () => {
  const baseClient = {
    id: 10n,
    code: 'CLI-001',
    business_name: 'Acme Corp',
    cuit: '20123456789',
    tax_condition_id: 1n,
    tax_conditions: { name: 'Responsable Inscripto' },
    address: 'Calle 123',
    city: 'Buenos Aires',
    postal_code: '1000',
    province_id: 1n,
    provinces: { name: 'Buenos Aires' },
    phone: '1122334455',
    email: 'acme@test.com',
    operation_type_id: 1n,
    operation_types: { name: 'Venta' },
    transporter_id: 2n,
    transporters: { name: 'TransCorp' },
    payment_term_id: 1,
    payment_terms: { name: 'Contado' },
    credit_limit: '50000.00',
    current_balance: '12500.00',
    is_active: true,
    seller_id: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-06-15'),
  };

  it('converts BigInt id and related ids', () => {
    const result = mapClientToDTO(baseClient);
    expect(result.id).toBe(10);
    expect(typeof result.id).toBe('number');
  });

  it('maps nested relation names', () => {
    const result = mapClientToDTO(baseClient);
    expect(result.taxConditionName).toBe('Responsable Inscripto');
    expect(result.provinceName).toBe('Buenos Aires');
    expect(result.operationTypeName).toBe('Venta');
    expect(result.transporterName).toBe('TransCorp');
    expect(result.paymentTermName).toBe('Contado');
  });

  it('handles missing relations gracefully', () => {
    const noRelations = {
      ...baseClient,
      tax_conditions: undefined,
      provinces: undefined,
      operation_types: undefined,
      transporters: undefined,
      payment_terms: undefined,
    };
    const result = mapClientToDTO(noRelations);
    expect(result.taxConditionName).toBe('');
    expect(result.provinceName).toBe('');
    expect(result.operationTypeName).toBe('');
    expect(result.transporterName).toBe('');
    expect(result.paymentTermName).toBeNull();
  });

  it('parses credit_limit and current_balance from Decimal strings', () => {
    const result = mapClientToDTO(baseClient);
    expect(result.creditLimit).toBe(50000);
    expect(result.currentBalance).toBe(12500);
  });

  it('handles null credit_limit', () => {
    const noCreditLimit = { ...baseClient, credit_limit: null };
    const result = mapClientToDTO(noCreditLimit);
    expect(result.creditLimit).toBeNull();
  });

  it('converts dates to ISO strings', () => {
    const result = mapClientToDTO(baseClient);
    expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(result.updatedAt).toBe('2024-06-15T00:00:00.000Z');
  });
});

describe('mapSalesOrderToDTO', () => {
  const baseOrder = {
    id: 100n,
    client_id: 10n,
    clients: { business_name: 'Acme Corp', cuit: '20123456789' },
    order_number: 'PV-00100',
    order_date: new Date('2024-03-15'),
    delivery_date: null,
    status: 'PENDING',
    payment_term_id: 1,
    payment_terms: { name: 'Contado' },
    total: '25000.0000',
    notes: null,
    special_discount_percent: '5.00',
    deleted_at: null,
    sales_order_items: [
      {
        id: 1n,
        article_id: 42n,
        articles: { code: 'ART-001', description: 'Brida Ciega', stock: '50' },
        quantity: 10,
        unit_price: '150.5000',
        discount_percent: '10.00',
        line_total: '1354.5000',
      },
    ],
    invoices: [],
    delivery_notes: [],
    created_at: new Date('2024-03-15'),
    updated_at: new Date('2024-03-15'),
  };

  it('maps order fields correctly', () => {
    const result = mapSalesOrderToDTO(baseOrder);
    expect(result.id).toBe(100);
    expect(result.clientId).toBe(10);
    expect(result.clientBusinessName).toBe('Acme Corp');
    expect(result.orderNumber).toBe('PV-00100');
    expect(result.status).toBe('PENDING');
    expect(result.total).toBe(25000);
    expect(result.specialDiscountPercent).toBe(5);
  });

  it('maps items with article data', () => {
    const result = mapSalesOrderToDTO(baseOrder);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].articleCode).toBe('ART-001');
    expect(result.items[0].articleDescription).toBe('Brida Ciega');
    expect(result.items[0].quantity).toBe(10);
    expect(result.items[0].unitPrice).toBe(150.5);
    expect(result.items[0].discountPercent).toBe(10);
    expect(result.items[0].lineTotal).toBe(1354.5);
  });

  it('reports hasInvoice correctly', () => {
    const withInvoice = {
      ...baseOrder,
      invoices: [{ id: 1n, invoice_number: 'FC-001', is_printed: true, is_cancelled: false }],
    };
    const result = mapSalesOrderToDTO(withInvoice);
    expect(result.hasInvoice).toBe(true);
  });

  it('hasInvoice is false when invoice is cancelled', () => {
    const withCancelled = {
      ...baseOrder,
      invoices: [{ id: 1n, invoice_number: 'FC-001', is_printed: true, is_cancelled: true }],
    };
    const result = mapSalesOrderToDTO(withCancelled);
    expect(result.hasInvoice).toBe(false);
  });

  it('reports isDeleted based on deleted_at', () => {
    expect(mapSalesOrderToDTO(baseOrder).isDeleted).toBe(false);

    const deleted = { ...baseOrder, deleted_at: new Date() };
    expect(mapSalesOrderToDTO(deleted).isDeleted).toBe(true);
  });

  it('handles empty items array', () => {
    const noItems = { ...baseOrder, sales_order_items: [] };
    const result = mapSalesOrderToDTO(noItems);
    expect(result.items).toEqual([]);
    expect(result.itemsCount).toBe(0);
  });
});

describe('mapInvoiceToDTO', () => {
  const baseInvoice = {
    id: 200n,
    invoice_number: 'FC-A-00001',
    sales_order_id: 100n,
    sales_orders: {
      order_number: 'PV-00100',
      special_discount_percent: 5,
      clients: {
        id: 10n,
        business_name: 'Acme Corp',
        cuit: '20123456789',
        tax_conditions: { name: 'Responsable Inscripto' },
      },
    },
    invoice_date: new Date('2024-04-01'),
    payment_term_id: 1,
    payment_terms: { name: 'Contado' },
    usd_exchange_rate: '1050.5000',
    net_amount: '10000.0000',
    tax_amount: '2100.0000',
    total_amount: '12100.0000',
    is_printed: true,
    printed_at: new Date('2024-04-01'),
    is_cancelled: false,
    cancelled_at: null,
    cancellation_reason: null,
    is_credit_note: false,
    is_quotation: false,
    notes: null,
    created_at: new Date('2024-04-01'),
    updated_at: new Date('2024-04-01'),
    invoice_items: [
      {
        id: 1n,
        sales_order_item_id: 1n,
        article_id: 42n,
        article_code: 'ART-001',
        article_description: 'Brida Ciega',
        quantity: 10,
        unit_price_usd: '15.0000',
        unit_price_ars: '15757.5000',
        discount_percent: '10.00',
        line_total: '141817.5000',
        created_at: new Date('2024-04-01'),
      },
    ],
  };

  it('maps invoice header fields', () => {
    const result = mapInvoiceToDTO(baseInvoice);
    expect(result.id).toBe(200);
    expect(result.invoiceNumber).toBe('FC-A-00001');
    expect(result.salesOrderId).toBe(100);
    expect(result.salesOrderNumber).toBe('PV-00100');
    expect(result.clientBusinessName).toBe('Acme Corp');
    expect(result.clientTaxCondition).toBe('Responsable Inscripto');
  });

  it('parses monetary amounts from Decimal strings', () => {
    const result = mapInvoiceToDTO(baseInvoice);
    expect(result.netAmount).toBe(10000);
    expect(result.taxAmount).toBe(2100);
    expect(result.totalAmount).toBe(12100);
    expect(result.usdExchangeRate).toBe(1050.5);
  });

  it('maps invoice items', () => {
    const result = mapInvoiceToDTO(baseInvoice);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].articleCode).toBe('ART-001');
    expect(result.items[0].quantity).toBe(10);
    expect(result.items[0].unitPriceUsd).toBe(15);
    expect(result.items[0].discountPercent).toBe(10);
  });

  it('maps special discount from sales order', () => {
    const result = mapInvoiceToDTO(baseInvoice);
    expect(result.specialDiscountPercent).toBe(5);
  });

  it('handles null exchange rate', () => {
    const noRate = { ...baseInvoice, usd_exchange_rate: null };
    const result = mapInvoiceToDTO(noRate);
    expect(result.usdExchangeRate).toBeNull();
  });
});

describe('mapDeliveryNoteToDTO', () => {
  const baseNote = {
    id: 300n,
    delivery_number: 'R-00050',
    sales_order_id: 100n,
    sales_orders: {
      order_number: 'PV-00100',
      clients: { business_name: 'Acme Corp' },
    },
    delivery_date: new Date('2024-04-05'),
    transporter_id: 2,
    transporters: { name: 'TransCorp' },
    weight_kg: '150.5',
    packages_count: 3,
    declared_value: '25000.00',
    notes: 'Fragile',
    created_at: new Date('2024-04-05'),
    updated_at: new Date('2024-04-05'),
    delivery_note_items: [
      {
        id: 1n,
        sales_order_item_id: 1n,
        article_id: 42n,
        article_code: 'ART-001',
        article_description: 'Brida Ciega',
        quantity: 10,
        created_at: new Date('2024-04-05'),
      },
    ],
  };

  it('maps header fields', () => {
    const result = mapDeliveryNoteToDTO(baseNote);
    expect(result.id).toBe(300);
    expect(result.deliveryNumber).toBe('R-00050');
    expect(result.salesOrderNumber).toBe('PV-00100');
    expect(result.clientBusinessName).toBe('Acme Corp');
    expect(result.transporterName).toBe('TransCorp');
  });

  it('parses numeric fields from Decimal strings', () => {
    const result = mapDeliveryNoteToDTO(baseNote);
    expect(result.weightKg).toBe(150.5);
    expect(result.packagesCount).toBe(3);
    expect(result.declaredValue).toBe(25000);
  });

  it('maps items', () => {
    const result = mapDeliveryNoteToDTO(baseNote);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].articleCode).toBe('ART-001');
    expect(result.items[0].quantity).toBe(10);
  });

  it('handles null optional fields', () => {
    const minimal = {
      ...baseNote,
      transporter_id: null,
      transporters: null,
      weight_kg: null,
      packages_count: null,
      declared_value: null,
      notes: null,
    };
    const result = mapDeliveryNoteToDTO(minimal);
    expect(result.transporterId).toBeNull();
    expect(result.transporterName).toBeNull();
    expect(result.weightKg).toBeNull();
    expect(result.packagesCount).toBeNull();
    expect(result.declaredValue).toBeNull();
    expect(result.notes).toBeNull();
  });
});
