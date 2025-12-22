import { z } from 'zod';

// Article Validation Schema
export const createArticleSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(50, 'El código no puede exceder 50 caracteres'),
  description: z.string().min(1, 'La descripción es requerida').max(500, 'La descripción no puede exceder 500 caracteres'),
  categoryId: z.coerce.bigint().refine(val => val > 0, 'Debe seleccionar una categoría válida'),
  unitPrice: z.coerce.number().min(0, 'El precio unitario no puede ser negativo'),
  costPrice: z.coerce.number().min(0, 'El precio de costo no puede ser negativo').optional().nullable(),
  stock: z.coerce.number().min(0, 'El stock no puede ser negativo').default(0),
  minimumStock: z.coerce.number().min(0, 'El stock mínimo no puede ser negativo').default(0),
  displayOrder: z.string().max(20).optional().nullable(),
  isDiscontinued: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  type: z.string().max(500).optional().nullable(),
  series: z.coerce.number().int().optional().nullable(),
  thickness: z.string().max(100).optional().nullable(),
  size: z.string().max(100).optional().nullable(),
  supplierId: z.coerce.number().int().optional().nullable(),
  weightKg: z.coerce.number().optional().nullable(),
  historicalPrice1: z.coerce.number().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateArticleSchema = createArticleSchema.partial().required({ code: true, description: true, categoryId: true });

// Category Validation Schema
export const createCategorySchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(20, 'El código no puede exceder 20 caracteres'),
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  description: z.string().max(500).optional().nullable(),
  defaultDiscountPercent: z.coerce.number().min(0).max(100, 'El descuento debe estar entre 0 y 100').default(0),
  isActive: z.boolean().optional().default(false),
});

export const updateCategorySchema = createCategorySchema.partial().required({ code: true, name: true });

// Client Validation Schema
export const createClientSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(20, 'El código no puede exceder 20 caracteres'),
  businessName: z.string().min(1, 'La razón social es requerida').max(200, 'La razón social no puede exceder 200 caracteres'),
  cuit: z.string().max(11).optional().nullable(),
  taxConditionId: z.coerce.number().int().min(1, 'Debe seleccionar una condición de IVA'),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(10).optional().nullable(),
  provinceId: z.coerce.number().int().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email('Email inválido').max(100).optional().nullable().or(z.literal('')),
  operationTypeId: z.coerce.number().int().min(1, 'Debe seleccionar un tipo de operación'),
  transporterId: z.coerce.number().int().optional().nullable(),
  sellerId: z.coerce.number().int().optional().nullable(),
  creditLimit: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateClientSchema = createClientSchema.partial().required({ code: true, businessName: true, taxConditionId: true, operationTypeId: true });

// Sales Order Item Schema
export const salesOrderItemSchema = z.object({
  articleId: z.coerce.bigint().refine(val => val > 0, 'ArticleId must be greater than 0'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be greater than 0'),
  unitPrice: z.coerce.number().min(0, 'UnitPrice must be greater than or equal to 0'),
  discountPercent: z.coerce.number().min(0).max(100, 'DiscountPercent must be between 0 and 100').default(0),
});

// Sales Order Validation Schema
export const createSalesOrderSchema = z.object({
  clientId: z.coerce.bigint().refine(val => val > 0, 'ClientId must be greater than 0'),
  orderDate: z.coerce.date().optional(),
  deliveryDate: z.coerce.date().optional().nullable(),
  status: z.string().optional().default('PENDING'),
  specialDiscountPercent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
  items: z.array(salesOrderItemSchema).min(1, 'Order must have at least one item'),
});

export const updateSalesOrderSchema = createSalesOrderSchema.partial().required({ clientId: true });

// Invoice Validation Schema
export const createInvoiceSchema = z.object({
  salesOrderId: z.coerce.bigint().refine(val => val > 0, 'Sales Order ID is required'),
  invoiceDate: z.coerce.date().optional().default(() => new Date()),
  usdExchangeRate: z.coerce.number().min(0).optional().nullable(),
  isCreditNote: z.boolean().optional().default(false),
  isQuotation: z.boolean().optional().default(false),
  notes: z.string().optional().nullable(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

// Delivery Note Validation Schema
export const deliveryNoteItemSchema = z.object({
  salesOrderItemId: z.coerce.bigint().optional().nullable(),
  articleId: z.coerce.bigint().refine(val => val > 0, 'Article ID is required'),
  articleCode: z.string().min(1, 'Article code is required'),
  articleDescription: z.string().min(1, 'Article description is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
});

export const createDeliveryNoteSchema = z.object({
  salesOrderId: z.coerce.bigint().refine(val => val > 0, 'Sales Order ID is required'),
  deliveryDate: z.coerce.date(),
  transporterId: z.coerce.number().int().optional().nullable(),
  weightKg: z.coerce.number().min(0).optional().nullable(),
  packagesCount: z.coerce.number().int().min(0).optional().nullable(),
  declaredValue: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(deliveryNoteItemSchema).min(1, 'At least one item is required'),
});

export const updateDeliveryNoteSchema = z.object({
  deliveryDate: z.coerce.date(),
  transporterId: z.coerce.number().int().optional().nullable(),
  weightKg: z.coerce.number().min(0).optional().nullable(),
  packagesCount: z.coerce.number().int().min(0).optional().nullable(),
  declaredValue: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Type exports
export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type SalesOrderItemInput = z.infer<typeof salesOrderItemSchema>;
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type CreateDeliveryNoteInput = z.infer<typeof createDeliveryNoteSchema>;
export type UpdateDeliveryNoteInput = z.infer<typeof updateDeliveryNoteSchema>;

