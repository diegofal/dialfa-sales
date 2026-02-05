/** Converts BigInt/number/Decimal to integer */
export function toInt(value: unknown): number {
  return parseInt(String(value));
}

/** Converts Decimal/BigInt/number to float */
export function toFloat(value: unknown): number {
  return parseFloat(String(value));
}

/** Converts value to float or null if falsy */
export function toFloatOrNull(value: unknown): number | null {
  return value ? parseFloat(String(value)) : null;
}

export interface ArticleDTO {
  id: number;
  code: string;
  description: string;
  categoryId: number;
  categoryName: string;
  unitPrice: number;
  stock: number;
  minimumStock: number;
  location: string | null;
  isDiscontinued: boolean;
  notes: string | null;
  costPrice: number | null;
  displayOrder: number | null;
  historicalPrice1: number | null;
  series: string | null;
  size: string | null;
  supplierId: bigint | null;
  thickness: string | null;
  type: string | null;
  weightKg: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryDTO {
  id: number;
  code: string;
  name: string;
  description: string | null;
  defaultDiscountPercent: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientDTO {
  id: number;
  code: string;
  businessName: string;
  cuit: string | null;
  taxConditionId: number;
  taxConditionName: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  provinceId: bigint | null;
  provinceName: string;
  phone: string | null;
  email: string | null;
  operationTypeId: bigint;
  operationTypeName: string;
  transporterId: bigint | null;
  transporterName: string;
  paymentTermId: number;
  paymentTermName: string | null;
  creditLimit: number | null;
  currentBalance: number;
  isActive: boolean;
  sellerId: bigint | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderItemDTO {
  id: number;
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  stock?: number;
}

export interface SalesOrderDTO {
  id: number;
  clientId: number;
  clientBusinessName: string;
  clientCuit: string;
  orderNumber: string;
  orderDate: Date;
  deliveryDate: Date | null;
  status: string;
  paymentTermId: number | null;
  paymentTermName: string | null;
  total: number;
  notes: string | null;
  specialDiscountPercent: number;
  itemsCount: number;
  isDeleted: boolean;
  hasInvoice: boolean;
  invoicePrinted: boolean;
  items: SalesOrderItemDTO[];
  invoice: { id: number; invoiceNumber: string; isPrinted: boolean; isCancelled: boolean } | null;
  deliveryNote: { id: number; deliveryNumber: string; deliveryDate: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItemDTO {
  id: number;
  salesOrderItemId: number | null;
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  unitPriceUsd: number;
  unitPriceArs: number;
  discountPercent: number;
  lineTotal: number;
  createdAt: string;
}

export interface InvoiceDTO {
  id: number;
  invoiceNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  clientId: number;
  clientBusinessName: string;
  clientCuit: string;
  clientTaxCondition: string;
  invoiceDate: Date;
  paymentTermId: number | null;
  paymentTermName: string | null;
  usdExchangeRate: number | null;
  specialDiscountPercent: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  isPrinted: boolean;
  printedAt: Date | null;
  isCancelled: boolean;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  isCreditNote: boolean;
  isQuotation: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: InvoiceItemDTO[];
}

export interface DeliveryNoteItemDTO {
  id: number;
  salesOrderItemId: number | null;
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  createdAt: string;
}

export interface DeliveryNoteDTO {
  id: number;
  deliveryNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  clientBusinessName: string;
  deliveryDate: string;
  transporterId: number | null;
  transporterName: string | null;
  weightKg: number | null;
  packagesCount: number | null;
  declaredValue: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: DeliveryNoteItemDTO[];
}

/**
 * Maps article data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapArticleToDTO(article: unknown): ArticleDTO {
  const a = article as Record<string, unknown>;
  const categories = a.categories as { name?: string } | undefined;

  return {
    id: toInt(a.id as bigint | number),
    code: a.code as string,
    description: a.description as string,
    categoryId: toInt(a.category_id as bigint | number),
    categoryName: categories?.name || '',
    unitPrice: toFloat(a.unit_price),
    stock: toFloat(a.stock),
    minimumStock: toFloat(a.minimum_stock),
    location: a.location as string | null,
    isDiscontinued: a.is_discontinued as boolean,
    notes: a.notes as string | null,
    costPrice: toFloatOrNull(a.cost_price),
    displayOrder: a.display_order as number | null,
    historicalPrice1: toFloatOrNull(a.historical_price1),
    series: a.series as string | null,
    size: a.size as string | null,
    supplierId: a.supplier_id as bigint | null,
    thickness: a.thickness as string | null,
    type: a.type as string | null,
    weightKg: toFloatOrNull(a.weight_kg),
    isActive: a.is_active as boolean,
    createdAt: a.created_at as Date,
    updatedAt: a.updated_at as Date,
  };
}

/**
 * Maps category data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapCategoryToDTO(category: unknown): CategoryDTO {
  const c = category as Record<string, unknown>;

  return {
    id: toInt(c.id as bigint | number),
    code: c.code as string,
    name: c.name as string,
    description: c.description as string | null,
    defaultDiscountPercent: toFloat(c.default_discount_percent),
    isActive: c.is_active as boolean,
    createdAt: c.created_at as Date,
    updatedAt: c.updated_at as Date,
  };
}

/**
 * Maps client data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapClientToDTO(client: unknown): ClientDTO {
  const c = client as Record<string, unknown>;
  const taxConditions = c.tax_conditions as { name?: string } | undefined;
  const provinces = c.provinces as { name?: string } | undefined;
  const operationTypes = c.operation_types as { name?: string } | undefined;
  const transporters = c.transporters as { name?: string } | undefined;
  const paymentTerms = c.payment_terms as { name?: string } | undefined;

  return {
    id: toInt(c.id as bigint | number),
    code: c.code as string,
    businessName: c.business_name as string,
    cuit: c.cuit as string | null,
    taxConditionId: toInt(c.tax_condition_id as bigint | number),
    taxConditionName: taxConditions?.name || '',
    address: c.address as string | null,
    city: c.city as string | null,
    postalCode: c.postal_code as string | null,
    provinceId: c.province_id as bigint | null,
    provinceName: provinces?.name || '',
    phone: c.phone as string | null,
    email: c.email as string | null,
    operationTypeId: c.operation_type_id as bigint,
    operationTypeName: operationTypes?.name || '',
    transporterId: c.transporter_id as bigint | null,
    transporterName: transporters?.name || '',
    paymentTermId: toInt(c.payment_term_id as bigint | number),
    paymentTermName: paymentTerms?.name || null,
    creditLimit: toFloatOrNull(c.credit_limit),
    currentBalance: toFloat(c.current_balance),
    isActive: c.is_active as boolean,
    sellerId: c.seller_id as bigint | null,
    createdAt: (c.created_at as Date).toISOString(),
    updatedAt: (c.updated_at as Date).toISOString(),
  };
}

/**
 * Maps sales order data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapSalesOrderToDTO(order: unknown): SalesOrderDTO {
  const o = order as Record<string, unknown>;
  const clients = o.clients as { business_name?: string; cuit?: string } | undefined;
  const paymentTerms = o.payment_terms as { name?: string } | undefined;
  const salesOrderItems = (o.sales_order_items as Array<Record<string, unknown>>) || [];
  const invoices = (o.invoices as Array<Record<string, unknown>>) || [];
  const deliveryNotes = (o.delivery_notes as Array<Record<string, unknown>>) || [];

  // Get the first (most recent) invoice and delivery note
  const invoice = invoices[0];
  const deliveryNote = deliveryNotes[0];

  return {
    id: toInt(o.id as bigint | number),
    clientId: toInt(o.client_id as bigint | number),
    clientBusinessName: clients?.business_name || '',
    clientCuit: clients?.cuit || '',
    orderNumber: o.order_number as string,
    orderDate: o.order_date as Date,
    deliveryDate: o.delivery_date as Date | null,
    status: o.status as string,
    paymentTermId: o.payment_term_id ? toInt(o.payment_term_id) : null,
    paymentTermName: paymentTerms?.name || null,
    total: toFloat(o.total),
    notes: o.notes as string | null,
    specialDiscountPercent: toFloat(o.special_discount_percent),
    itemsCount: salesOrderItems.length,
    isDeleted: !!o.deleted_at,
    // For permission calculations
    hasInvoice: !!invoice && !(invoice.is_cancelled as boolean),
    invoicePrinted: invoice ? (invoice.is_printed as boolean) : false,
    items: salesOrderItems.map((item) => {
      const articles = item.articles as
        | {
            code?: string;
            description?: string;
            stock?: number;
          }
        | undefined;

      return {
        id: toInt(item.id as bigint | number),
        articleId: toInt(item.article_id as bigint | number),
        articleCode: articles?.code || '',
        articleDescription: articles?.description || '',
        quantity: item.quantity as number,
        unitPrice: toFloat(item.unit_price),
        discountPercent: toFloat(item.discount_percent),
        lineTotal: toFloat(item.line_total),
        stock: articles?.stock !== undefined ? toFloat(articles.stock) : undefined,
      };
    }),
    // Related documents for permission calculations
    invoice: invoice
      ? {
          id: toInt(invoice.id as bigint | number),
          invoiceNumber: invoice.invoice_number as string,
          isPrinted: invoice.is_printed as boolean,
          isCancelled: invoice.is_cancelled as boolean,
        }
      : null,
    deliveryNote: deliveryNote
      ? {
          id: toInt(deliveryNote.id as bigint | number),
          deliveryNumber: deliveryNote.delivery_number as string,
          deliveryDate: (deliveryNote.delivery_date as Date).toISOString(),
        }
      : null,
    createdAt: o.created_at as Date,
    updatedAt: o.updated_at as Date,
  };
}

/**
 * Maps invoice data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapInvoiceToDTO(invoice: unknown): InvoiceDTO {
  const i = invoice as Record<string, unknown>;
  const salesOrders = i.sales_orders as
    | {
        order_number?: string;
        clients?: {
          business_name?: string;
          cuit?: string;
          tax_conditions?: { name?: string };
        };
        special_discount_percent?: number;
      }
    | undefined;
  const paymentTerms = i.payment_terms as { name?: string } | undefined;

  // Use invoice_items instead of sales_order_items
  const invoiceItems = (i.invoice_items || []) as Array<Record<string, unknown>>;

  return {
    id: toInt(i.id as bigint | number),
    invoiceNumber: i.invoice_number as string,
    salesOrderId: toInt(i.sales_order_id as bigint | number),
    salesOrderNumber: salesOrders?.order_number || '',
    clientId: toInt((salesOrders?.clients as Record<string, unknown>)?.id || 0),
    clientBusinessName: salesOrders?.clients?.business_name || '',
    clientCuit: salesOrders?.clients?.cuit || '',
    clientTaxCondition: salesOrders?.clients?.tax_conditions?.name || '',
    invoiceDate: i.invoice_date as Date,
    paymentTermId: i.payment_term_id ? toInt(i.payment_term_id) : null,
    paymentTermName: paymentTerms?.name || null,
    usdExchangeRate: toFloatOrNull(i.usd_exchange_rate),
    specialDiscountPercent: salesOrders?.special_discount_percent
      ? toFloat(salesOrders.special_discount_percent)
      : 0,
    netAmount: toFloat(i.net_amount),
    taxAmount: toFloat(i.tax_amount),
    totalAmount: toFloat(i.total_amount),
    isPrinted: i.is_printed as boolean,
    printedAt: i.printed_at as Date | null,
    isCancelled: i.is_cancelled as boolean,
    cancelledAt: i.cancelled_at as Date | null,
    cancellationReason: i.cancellation_reason as string | null,
    isCreditNote: i.is_credit_note as boolean,
    isQuotation: i.is_quotation as boolean,
    notes: i.notes as string | null,
    createdAt: i.created_at as Date,
    updatedAt: i.updated_at as Date,
    items: invoiceItems.map((item) => {
      return {
        id: toInt(item.id as bigint | number),
        salesOrderItemId: item.sales_order_item_id
          ? toInt(item.sales_order_item_id as bigint | number)
          : null,
        articleId: toInt(item.article_id as bigint | number),
        articleCode: item.article_code as string,
        articleDescription: item.article_description as string,
        quantity: item.quantity as number,
        unitPriceUsd: toFloat(item.unit_price_usd),
        unitPriceArs: toFloat(item.unit_price_ars),
        discountPercent: toFloat(item.discount_percent),
        lineTotal: toFloat(item.line_total),
        createdAt: (item.created_at as Date).toISOString(),
      };
    }),
  };
}

/**
 * Maps delivery note data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapDeliveryNoteToDTO(deliveryNote: unknown): DeliveryNoteDTO {
  const d = deliveryNote as Record<string, unknown>;
  const salesOrders = d.sales_orders as
    | {
        order_number?: string;
        clients?: { business_name?: string };
      }
    | undefined;
  const transporters = d.transporters as { name?: string } | undefined;

  // Use delivery_note_items instead of sales_order_items
  const deliveryNoteItems = (d.delivery_note_items || []) as Array<Record<string, unknown>>;

  return {
    id: toInt(d.id as bigint | number),
    deliveryNumber: d.delivery_number as string,
    salesOrderId: toInt(d.sales_order_id as bigint | number),
    salesOrderNumber: salesOrders?.order_number || '',
    clientBusinessName: salesOrders?.clients?.business_name || '',
    deliveryDate: (d.delivery_date as Date).toISOString(),
    transporterId: d.transporter_id ? toInt(d.transporter_id) : null,
    transporterName: transporters?.name || null,
    weightKg: toFloatOrNull(d.weight_kg),
    packagesCount: d.packages_count ? Number(d.packages_count) : null,
    declaredValue: toFloatOrNull(d.declared_value),
    notes: d.notes as string | null,
    createdAt: (d.created_at as Date).toISOString(),
    updatedAt: (d.updated_at as Date).toISOString(),
    items: deliveryNoteItems.map((item) => {
      return {
        id: toInt(item.id as bigint | number),
        salesOrderItemId: item.sales_order_item_id
          ? toInt(item.sales_order_item_id as bigint | number)
          : null,
        articleId: toInt(item.article_id as bigint | number),
        articleCode: item.article_code as string,
        articleDescription: item.article_description as string,
        quantity: item.quantity as number,
        createdAt: (item.created_at as Date).toISOString(),
      };
    }),
  };
}
