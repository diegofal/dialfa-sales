/**
 * Maps article data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapArticleToDTO(article: unknown) {
  const a = article as Record<string, unknown>;
  const categories = a.categories as { name?: string } | undefined;
  
  return {
    id: parseInt(String((a.id as bigint | number))),
    code: a.code as string,
    description: a.description as string,
    categoryId: parseInt(String((a.category_id as bigint | number))),
    categoryName: categories?.name || '',
    unitPrice: parseFloat(String(a.unit_price)),
    stock: parseFloat(String(a.stock)),
    minimumStock: parseFloat(String(a.minimum_stock)),
    location: a.location as string | null,
    isDiscontinued: a.is_discontinued as boolean,
    notes: a.notes as string | null,
    costPrice: a.cost_price ? parseFloat(String(a.cost_price)) : null,
    displayOrder: a.display_order as number | null,
    historicalPrice1: a.historical_price1 ? parseFloat(String(a.historical_price1)) : null,
    series: a.series as string | null,
    size: a.size as string | null,
    supplierId: a.supplier_id as bigint | null,
    thickness: a.thickness as string | null,
    type: a.type as string | null,
    weightKg: a.weight_kg ? parseFloat(String(a.weight_kg)) : null,
    isActive: a.is_active as boolean,
    createdAt: a.created_at as Date,
    updatedAt: a.updated_at as Date,
  };
}

/**
 * Maps category data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapCategoryToDTO(category: unknown) {
  const c = category as Record<string, unknown>;
  
  return {
    id: parseInt(String((c.id as bigint | number))),
    code: c.code as string,
    name: c.name as string,
    description: c.description as string | null,
    defaultDiscountPercent: parseFloat(String(c.default_discount_percent)),
    isActive: c.is_active as boolean,
    createdAt: c.created_at as Date,
    updatedAt: c.updated_at as Date,
  };
}

/**
 * Maps client data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapClientToDTO(client: unknown) {
  const c = client as Record<string, unknown>;
  const taxConditions = c.tax_conditions as { name?: string } | undefined;
  const provinces = c.provinces as { name?: string } | undefined;
  const operationTypes = c.operation_types as { name?: string } | undefined;
  const transporters = c.transporters as { name?: string } | undefined;
  
  return {
    id: parseInt(String((c.id as bigint | number))),
    code: c.code as string,
    businessName: c.business_name as string,
    cuit: c.cuit as string | null,
    taxConditionId: parseInt(String(c.tax_condition_id as bigint | number)),
    taxConditionName: taxConditions?.name || '',
    address: c.address as string | null,
    city: c.city as string | null,
    postalCode: c.postal_code as string | null,
    provinceId: c.province_id ? parseInt(String(c.province_id as bigint | number)) : null,
    provinceName: provinces?.name || '',
    phone: c.phone as string | null,
    email: c.email as string | null,
    operationTypeId: parseInt(String(c.operation_type_id as bigint | number)),
    operationTypeName: operationTypes?.name || '',
    transporterId: c.transporter_id ? parseInt(String(c.transporter_id as bigint | number)) : null,
    transporterName: transporters?.name || '',
    creditLimit: c.credit_limit ? parseFloat(String(c.credit_limit)) : null,
    sellerId: c.seller_id as bigint | null,
    createdAt: c.created_at as Date,
    updatedAt: c.updated_at as Date,
  };
}

/**
 * Maps sales order data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapSalesOrderToDTO(order: unknown) {
  const o = order as Record<string, unknown>;
  const clients = o.clients as { business_name?: string } | undefined;
  const salesOrderItems = (o.sales_order_items as Array<Record<string, unknown>>) || [];
  const invoices = (o.invoices as Array<Record<string, unknown>>) || [];
  const deliveryNotes = (o.delivery_notes as Array<Record<string, unknown>>) || [];
  
  // Get the first (most recent) invoice and delivery note
  const invoice = invoices[0];
  const deliveryNote = deliveryNotes[0];
  
  return {
    id: parseInt(String((o.id as bigint | number))),
    clientId: parseInt(String((o.client_id as bigint | number))),
    clientBusinessName: clients?.business_name || '',
    orderNumber: o.order_number as string,
    orderDate: o.order_date as Date,
    deliveryDate: o.delivery_date as Date | null,
    status: o.status as string,
    total: parseFloat(String(o.total)),
    notes: o.notes as string | null,
    specialDiscountPercent: parseFloat(String(o.special_discount_percent)),
    itemsCount: salesOrderItems.length,
    isDeleted: !!o.deleted_at,
    // For permission calculations
    hasInvoice: !!invoice && !(invoice.is_cancelled as boolean),
    invoicePrinted: invoice ? (invoice.is_printed as boolean) : false,
    items: salesOrderItems.map((item) => {
      const articles = item.articles as { 
        code?: string; 
        description?: string;
        stock?: number;
      } | undefined;
      
      return {
        id: parseInt(String((item.id as bigint | number))),
        articleId: parseInt(String((item.article_id as bigint | number))),
        articleCode: articles?.code || '',
        articleDescription: articles?.description || '',
        quantity: item.quantity as number,
        unitPrice: parseFloat(String(item.unit_price)),
        discountPercent: parseFloat(String(item.discount_percent)),
        lineTotal: parseFloat(String(item.line_total)),
        stock: articles?.stock !== undefined ? parseFloat(String(articles.stock)) : undefined,
      };
    }),
    // Related documents for permission calculations
    invoice: invoice ? {
      id: parseInt(String((invoice.id as bigint | number))),
      invoiceNumber: invoice.invoice_number as string,
      isPrinted: invoice.is_printed as boolean,
      isCancelled: invoice.is_cancelled as boolean,
    } : null,
    deliveryNote: deliveryNote ? {
      id: parseInt(String((deliveryNote.id as bigint | number))),
      deliveryNumber: deliveryNote.delivery_number as string,
      deliveryDate: (deliveryNote.delivery_date as Date).toISOString(),
    } : null,
    createdAt: o.created_at as Date,
    updatedAt: o.updated_at as Date,
  };
}

/**
 * Maps invoice data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapInvoiceToDTO(invoice: unknown) {
  const i = invoice as Record<string, unknown>;
  const salesOrders = i.sales_orders as {
    order_number?: string;
    clients?: { 
      business_name?: string;
      cuit?: string;
      tax_conditions?: { name?: string };
    };
    special_discount_percent?: number;
  } | undefined;
  
  // Use invoice_items instead of sales_order_items
  const invoiceItems = (i.invoice_items || []) as Array<Record<string, unknown>>;
  
  return {
    id: parseInt(String((i.id as bigint | number))),
    invoiceNumber: i.invoice_number as string,
    salesOrderId: parseInt(String((i.sales_order_id as bigint | number))),
    salesOrderNumber: salesOrders?.order_number || '',
    clientId: parseInt(String((salesOrders?.clients as Record<string, unknown>)?.id || 0)),
    clientBusinessName: salesOrders?.clients?.business_name || '',
    clientCuit: salesOrders?.clients?.cuit || '',
    clientTaxCondition: salesOrders?.clients?.tax_conditions?.name || '',
    invoiceDate: i.invoice_date as Date,
    usdExchangeRate: i.usd_exchange_rate ? parseFloat(String(i.usd_exchange_rate)) : null,
    specialDiscountPercent: salesOrders?.special_discount_percent ? parseFloat(String(salesOrders.special_discount_percent)) : 0,
    netAmount: parseFloat(String(i.net_amount)),
    taxAmount: parseFloat(String(i.tax_amount)),
    totalAmount: parseFloat(String(i.total_amount)),
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
        id: parseInt(String((item.id as bigint | number))),
        salesOrderItemId: item.sales_order_item_id ? parseInt(String(item.sales_order_item_id as bigint | number)) : null,
        articleId: parseInt(String((item.article_id as bigint | number))),
        articleCode: item.article_code as string,
        articleDescription: item.article_description as string,
        quantity: item.quantity as number,
        unitPriceUsd: parseFloat(String(item.unit_price_usd)),
        unitPriceArs: parseFloat(String(item.unit_price_ars)),
        discountPercent: parseFloat(String(item.discount_percent)),
        lineTotal: parseFloat(String(item.line_total)),
        createdAt: (item.created_at as Date).toISOString(),
      };
    }),
  };
}

/**
 * Maps delivery note data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapDeliveryNoteToDTO(deliveryNote: unknown) {
  const d = deliveryNote as Record<string, unknown>;
  const salesOrders = d.sales_orders as {
    order_number?: string;
    clients?: { business_name?: string };
  } | undefined;
  const transporters = d.transporters as { name?: string; address?: string | null } | undefined;
  
  // Use delivery_note_items instead of sales_order_items
  const deliveryNoteItems = (d.delivery_note_items || []) as Array<Record<string, unknown>>;
  
  return {
    id: parseInt(String((d.id as bigint | number))),
    deliveryNumber: d.delivery_number as string,
    salesOrderId: parseInt(String((d.sales_order_id as bigint | number))),
    salesOrderNumber: salesOrders?.order_number || '',
    clientBusinessName: salesOrders?.clients?.business_name || '',
    deliveryDate: (d.delivery_date as Date).toISOString(),
    transporterId: d.transporter_id ? parseInt(String(d.transporter_id)) : null,
    transporterName: transporters?.name || null,
    transporterAddress: transporters?.address || null,
    weightKg: d.weight_kg ? parseFloat(String(d.weight_kg)) : null,
    packagesCount: d.packages_count ? Number(d.packages_count) : null,
    declaredValue: d.declared_value ? parseFloat(String(d.declared_value)) : null,
    notes: d.notes as string | null,
    createdAt: (d.created_at as Date).toISOString(),
    updatedAt: (d.updated_at as Date).toISOString(),
    items: deliveryNoteItems.map((item) => {
      return {
        id: parseInt(String((item.id as bigint | number))),
        salesOrderItemId: item.sales_order_item_id ? parseInt(String(item.sales_order_item_id as bigint | number)) : null,
        articleId: parseInt(String((item.article_id as bigint | number))),
        articleCode: item.article_code as string,
        articleDescription: item.article_description as string,
        quantity: item.quantity as number,
        createdAt: (item.created_at as Date).toISOString(),
      };
    }),
  };
}


