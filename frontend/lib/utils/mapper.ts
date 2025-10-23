/**
 * Maps article data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapArticleToDTO(article: any) {
  return {
    id: parseInt(article.id.toString()),
    code: article.code,
    description: article.description,
    categoryId: parseInt(article.category_id.toString()),
    categoryName: article.categories?.name || '',
    unitPrice: parseFloat(article.unit_price.toString()),
    stock: parseFloat(article.stock.toString()),
    minimumStock: parseFloat(article.minimum_stock.toString()),
    location: article.location,
    isDiscontinued: article.is_discontinued,
    notes: article.notes,
    costPrice: article.cost_price ? parseFloat(article.cost_price.toString()) : null,
    displayOrder: article.display_order,
    historicalPrice1: article.historical_price1 ? parseFloat(article.historical_price1.toString()) : null,
    series: article.series,
    size: article.size,
    supplierId: article.supplier_id,
    thickness: article.thickness,
    type: article.type,
    weightKg: article.weight_kg ? parseFloat(article.weight_kg.toString()) : null,
    isActive: article.is_active,
    createdAt: article.created_at,
    updatedAt: article.updated_at,
  };
}

/**
 * Maps category data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapCategoryToDTO(category: any) {
  return {
    id: parseInt(category.id.toString()),
    code: category.code,
    name: category.name,
    description: category.description,
    defaultDiscountPercent: parseFloat(category.default_discount_percent.toString()),
    isActive: category.is_active,
    createdAt: category.created_at,
    updatedAt: category.updated_at,
  };
}

/**
 * Maps client data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapClientToDTO(client: any) {
  return {
    id: parseInt(client.id.toString()),
    code: client.code,
    businessName: client.business_name,
    cuit: client.cuit,
    taxConditionId: client.tax_condition_id,
    taxConditionName: client.tax_conditions?.name || '',
    address: client.address,
    city: client.city,
    postalCode: client.postal_code,
    provinceId: client.province_id,
    provinceName: client.provinces?.name || '',
    phone: client.phone,
    email: client.email,
    operationTypeId: client.operation_type_id,
    operationTypeName: client.operation_types?.name || '',
    transporterId: client.transporter_id,
    transporterName: client.transporters?.name || '',
    creditLimit: client.credit_limit ? parseFloat(client.credit_limit.toString()) : null,
    currentBalance: parseFloat(client.current_balance.toString()),
    isActive: client.is_active,
    sellerId: client.seller_id,
    createdAt: client.created_at,
    updatedAt: client.updated_at,
  };
}

/**
 * Maps sales order data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapSalesOrderToDTO(order: any) {
  return {
    id: parseInt(order.id.toString()),
    clientId: parseInt(order.client_id.toString()),
    clientBusinessName: order.clients?.business_name || '',
    orderNumber: order.order_number,
    orderDate: order.order_date,
    deliveryDate: order.delivery_date,
    status: order.status,
    total: parseFloat(order.total.toString()),
    notes: order.notes,
    specialDiscountPercent: parseFloat(order.special_discount_percent.toString()),
    itemsCount: order.sales_order_items?.length || 0,
    items: order.sales_order_items?.map((item: any) => ({
      id: parseInt(item.id.toString()),
      articleId: parseInt(item.article_id.toString()),
      articleCode: item.articles?.code || '',
      articleDescription: item.articles?.description || '',
      quantity: item.quantity,
      unitPrice: parseFloat(item.unit_price.toString()),
      discountPercent: parseFloat(item.discount_percent.toString()),
      lineTotal: parseFloat(item.line_total.toString()),
    })) || [],
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

/**
 * Maps invoice data from Prisma (snake_case) to frontend format (camelCase)
 */
export function mapInvoiceToDTO(invoice: any) {
  return {
    id: parseInt(invoice.id.toString()),
    invoiceNumber: invoice.invoice_number,
    salesOrderId: parseInt(invoice.sales_order_id.toString()),
    salesOrderNumber: invoice.sales_orders?.order_number || '',
    clientBusinessName: invoice.sales_orders?.clients?.business_name || '',
    invoiceDate: invoice.invoice_date,
    netAmount: parseFloat(invoice.net_amount.toString()),
    taxAmount: parseFloat(invoice.tax_amount.toString()),
    totalAmount: parseFloat(invoice.total_amount.toString()),
    notes: invoice.notes,
    isCancelled: invoice.is_cancelled,
    cancelledAt: invoice.cancelled_at,
    cancellationReason: invoice.cancellation_reason,
    isPrinted: invoice.is_printed,
    printedAt: invoice.printed_at,
    usdExchangeRate: invoice.usd_exchange_rate ? parseFloat(invoice.usd_exchange_rate.toString()) : null,
    isCreditNote: invoice.is_credit_note,
    isQuotation: invoice.is_quotation,
    itemsCount: invoice.sales_orders?.sales_order_items?.length || 0,
    createdAt: invoice.created_at,
    updatedAt: invoice.updated_at,
  };
}


