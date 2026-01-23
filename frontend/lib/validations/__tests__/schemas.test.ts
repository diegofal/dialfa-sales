import {
  createArticleSchema,
  updateArticleSchema,
  createCategorySchema,
  createClientSchema,
  salesOrderItemSchema,
  createSalesOrderSchema,
  createInvoiceSchema,
  createDeliveryNoteSchema,
  deliveryNoteItemSchema,
} from '../schemas';

describe('createArticleSchema', () => {
  const validArticle = {
    code: 'ART-001',
    description: 'Brida Ciega 1/2',
    categoryId: 1n,
    unitPrice: 150.5,
  };

  it('accepts valid minimal article', () => {
    const result = createArticleSchema.safeParse(validArticle);
    expect(result.success).toBe(true);
  });

  it('accepts full article with all optional fields', () => {
    const full = {
      ...validArticle,
      costPrice: 80.25,
      stock: 100,
      minimumStock: 10,
      displayOrder: 'A-01',
      isDiscontinued: true,
      isActive: false,
      type: 'Ciega',
      series: 150,
      thickness: '3/4',
      size: '1/2',
      supplierId: 5,
      weightKg: 2.5,
      lastPurchasePrice: 70.0,
      cifPercentage: 12.5,
      historicalPrice1: 120.0,
      location: 'Estante A-1',
      notes: 'Nota de prueba',
    };
    const result = createArticleSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it('rejects empty code', () => {
    const result = createArticleSchema.safeParse({ ...validArticle, code: '' });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain('código es requerido');
  });

  it('rejects code exceeding 50 characters', () => {
    const result = createArticleSchema.safeParse({ ...validArticle, code: 'A'.repeat(51) });
    expect(result.success).toBe(false);
  });

  it('rejects empty description', () => {
    const result = createArticleSchema.safeParse({ ...validArticle, description: '' });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain('descripción es requerida');
  });

  it('rejects negative unit price', () => {
    const result = createArticleSchema.safeParse({ ...validArticle, unitPrice: -1 });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toContain('negativo');
  });

  it('rejects negative cost price', () => {
    const result = createArticleSchema.safeParse({ ...validArticle, costPrice: -5 });
    expect(result.success).toBe(false);
  });

  it('rejects negative stock', () => {
    const result = createArticleSchema.safeParse({ ...validArticle, stock: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects cifPercentage over 100', () => {
    const result = createArticleSchema.safeParse({ ...validArticle, cifPercentage: 101 });
    expect(result.success).toBe(false);
  });

  it('coerces string numbers to number type', () => {
    const withStrings = { ...validArticle, unitPrice: '150.50', stock: '100' };
    const result = createArticleSchema.safeParse(withStrings);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unitPrice).toBe(150.5);
      expect(result.data.stock).toBe(100);
    }
  });

  it('coerces categoryId to bigint', () => {
    const withString = { ...validArticle, categoryId: '5' };
    const result = createArticleSchema.safeParse(withString);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categoryId).toBe(5n);
    }
  });

  it('rejects categoryId of 0', () => {
    const result = createArticleSchema.safeParse({ ...validArticle, categoryId: 0 });
    expect(result.success).toBe(false);
  });

  it('allows null for optional nullable fields', () => {
    const result = createArticleSchema.safeParse({
      ...validArticle,
      costPrice: null,
      notes: null,
      supplierId: null,
      type: null,
    });
    expect(result.success).toBe(true);
  });

  it('defaults stock and minimumStock to 0', () => {
    const result = createArticleSchema.safeParse(validArticle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stock).toBe(0);
      expect(result.data.minimumStock).toBe(0);
    }
  });

  it('defaults isDiscontinued to false and isActive to true', () => {
    const result = createArticleSchema.safeParse(validArticle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDiscontinued).toBe(false);
      expect(result.data.isActive).toBe(true);
    }
  });
});

describe('updateArticleSchema', () => {
  it('requires code, description, and categoryId', () => {
    const result = updateArticleSchema.safeParse({ unitPrice: 100 });
    expect(result.success).toBe(false);
  });

  it('accepts partial update with required fields', () => {
    const result = updateArticleSchema.safeParse({
      code: 'ART-001',
      description: 'Updated',
      categoryId: 1n,
      unitPrice: 200,
    });
    expect(result.success).toBe(true);
  });

  it('allows omitting optional fields that are required in create', () => {
    const result = updateArticleSchema.safeParse({
      code: 'ART-001',
      description: 'Updated',
      categoryId: 1n,
    });
    expect(result.success).toBe(true);
  });
});

describe('createCategorySchema', () => {
  const validCategory = {
    code: 'BRI',
    name: 'Bridas',
  };

  it('accepts valid minimal category', () => {
    const result = createCategorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
  });

  it('rejects empty code', () => {
    const result = createCategorySchema.safeParse({ ...validCategory, code: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createCategorySchema.safeParse({ ...validCategory, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects code exceeding 20 characters', () => {
    const result = createCategorySchema.safeParse({ ...validCategory, code: 'A'.repeat(21) });
    expect(result.success).toBe(false);
  });

  it('rejects discount over 100', () => {
    const result = createCategorySchema.safeParse({
      ...validCategory,
      defaultDiscountPercent: 101,
    });
    expect(result.success).toBe(false);
  });

  it('defaults defaultDiscountPercent to 0', () => {
    const result = createCategorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultDiscountPercent).toBe(0);
    }
  });
});

describe('createClientSchema', () => {
  const validClient = {
    code: 'CLI-001',
    businessName: 'Acme Corp',
    taxConditionId: 1,
    operationTypeId: 1,
    paymentTermId: 1,
  };

  it('accepts valid minimal client', () => {
    const result = createClientSchema.safeParse(validClient);
    expect(result.success).toBe(true);
  });

  it('rejects empty code', () => {
    const result = createClientSchema.safeParse({ ...validClient, code: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty business name', () => {
    const result = createClientSchema.safeParse({ ...validClient, businessName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid taxConditionId (0)', () => {
    const result = createClientSchema.safeParse({ ...validClient, taxConditionId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid operationTypeId (0)', () => {
    const result = createClientSchema.safeParse({ ...validClient, operationTypeId: 0 });
    expect(result.success).toBe(false);
  });

  it('validates email format when provided', () => {
    const result = createClientSchema.safeParse({ ...validClient, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('allows empty string for email', () => {
    const result = createClientSchema.safeParse({ ...validClient, email: '' });
    expect(result.success).toBe(true);
  });

  it('allows null for email', () => {
    const result = createClientSchema.safeParse({ ...validClient, email: null });
    expect(result.success).toBe(true);
  });

  it('accepts valid email', () => {
    const result = createClientSchema.safeParse({ ...validClient, email: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects negative credit limit', () => {
    const result = createClientSchema.safeParse({ ...validClient, creditLimit: -1000 });
    expect(result.success).toBe(false);
  });

  it('allows null optional fields', () => {
    const result = createClientSchema.safeParse({
      ...validClient,
      cuit: null,
      address: null,
      city: null,
      postalCode: null,
      provinceId: null,
      phone: null,
      email: null,
      transporterId: null,
      sellerId: null,
      creditLimit: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('salesOrderItemSchema', () => {
  const validItem = {
    articleId: 1n,
    quantity: 5,
    unitPrice: 100,
  };

  it('accepts valid item', () => {
    const result = salesOrderItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it('rejects quantity of 0', () => {
    const result = salesOrderItemSchema.safeParse({ ...validItem, quantity: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative unit price', () => {
    const result = salesOrderItemSchema.safeParse({ ...validItem, unitPrice: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects discount over 100', () => {
    const result = salesOrderItemSchema.safeParse({ ...validItem, discountPercent: 101 });
    expect(result.success).toBe(false);
  });

  it('defaults discountPercent to 0', () => {
    const result = salesOrderItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.discountPercent).toBe(0);
    }
  });

  it('rejects articleId of 0', () => {
    const result = salesOrderItemSchema.safeParse({ ...validItem, articleId: 0 });
    expect(result.success).toBe(false);
  });
});

describe('createSalesOrderSchema', () => {
  const validOrder = {
    clientId: 1n,
    paymentTermId: 1,
    items: [{ articleId: 1n, quantity: 5, unitPrice: 100 }],
  };

  it('accepts valid minimal order', () => {
    const result = createSalesOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it('rejects empty items array', () => {
    const result = createSalesOrderSchema.safeParse({ ...validOrder, items: [] });
    expect(result.success).toBe(false);
  });

  it('rejects clientId of 0', () => {
    const result = createSalesOrderSchema.safeParse({ ...validOrder, clientId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects specialDiscountPercent over 100', () => {
    const result = createSalesOrderSchema.safeParse({ ...validOrder, specialDiscountPercent: 101 });
    expect(result.success).toBe(false);
  });

  it('defaults status to PENDING', () => {
    const result = createSalesOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('PENDING');
    }
  });

  it('defaults specialDiscountPercent to 0', () => {
    const result = createSalesOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.specialDiscountPercent).toBe(0);
    }
  });

  it('allows null delivery date', () => {
    const result = createSalesOrderSchema.safeParse({ ...validOrder, deliveryDate: null });
    expect(result.success).toBe(true);
  });

  it('coerces date strings to Date objects', () => {
    const result = createSalesOrderSchema.safeParse({
      ...validOrder,
      orderDate: '2024-03-15',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderDate).toBeInstanceOf(Date);
    }
  });

  it('validates nested items', () => {
    const result = createSalesOrderSchema.safeParse({
      ...validOrder,
      items: [{ articleId: 0, quantity: 0, unitPrice: -1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('createInvoiceSchema', () => {
  const validInvoice = {
    salesOrderId: 1n,
  };

  it('accepts valid minimal invoice', () => {
    const result = createInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
  });

  it('rejects salesOrderId of 0', () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, salesOrderId: 0 });
    expect(result.success).toBe(false);
  });

  it('defaults isCreditNote to false', () => {
    const result = createInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isCreditNote).toBe(false);
    }
  });

  it('defaults isQuotation to false', () => {
    const result = createInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isQuotation).toBe(false);
    }
  });

  it('rejects negative usdExchangeRate', () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, usdExchangeRate: -1 });
    expect(result.success).toBe(false);
  });

  it('allows null optional fields', () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      paymentTermId: null,
      usdExchangeRate: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('createDeliveryNoteSchema', () => {
  const validNote = {
    salesOrderId: 1n,
    deliveryDate: new Date('2024-04-05'),
    items: [
      {
        articleId: 1n,
        articleCode: 'ART-001',
        articleDescription: 'Test Article',
        quantity: 10,
      },
    ],
  };

  it('accepts valid minimal delivery note', () => {
    const result = createDeliveryNoteSchema.safeParse(validNote);
    expect(result.success).toBe(true);
  });

  it('rejects empty items array', () => {
    const result = createDeliveryNoteSchema.safeParse({ ...validNote, items: [] });
    expect(result.success).toBe(false);
  });

  it('rejects salesOrderId of 0', () => {
    const result = createDeliveryNoteSchema.safeParse({ ...validNote, salesOrderId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative weightKg', () => {
    const result = createDeliveryNoteSchema.safeParse({ ...validNote, weightKg: -5 });
    expect(result.success).toBe(false);
  });

  it('rejects negative packagesCount', () => {
    const result = createDeliveryNoteSchema.safeParse({ ...validNote, packagesCount: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects negative declaredValue', () => {
    const result = createDeliveryNoteSchema.safeParse({ ...validNote, declaredValue: -100 });
    expect(result.success).toBe(false);
  });

  it('allows null optional fields', () => {
    const result = createDeliveryNoteSchema.safeParse({
      ...validNote,
      transporterId: null,
      weightKg: null,
      packagesCount: null,
      declaredValue: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('deliveryNoteItemSchema', () => {
  const validItem = {
    articleId: 1n,
    articleCode: 'ART-001',
    articleDescription: 'Test Article',
    quantity: 5,
  };

  it('accepts valid item', () => {
    const result = deliveryNoteItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it('rejects articleId of 0', () => {
    const result = deliveryNoteItemSchema.safeParse({ ...validItem, articleId: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects empty article code', () => {
    const result = deliveryNoteItemSchema.safeParse({ ...validItem, articleCode: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty article description', () => {
    const result = deliveryNoteItemSchema.safeParse({ ...validItem, articleDescription: '' });
    expect(result.success).toBe(false);
  });

  it('rejects quantity of 0', () => {
    const result = deliveryNoteItemSchema.safeParse({ ...validItem, quantity: 0 });
    expect(result.success).toBe(false);
  });

  it('allows null salesOrderItemId', () => {
    const result = deliveryNoteItemSchema.safeParse({ ...validItem, salesOrderItemId: null });
    expect(result.success).toBe(true);
  });
});
