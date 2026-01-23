import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma, Prisma } from '@/lib/db';
import { logActivity } from '@/lib/services/activityLogger';
import { ArticleMatcher } from '@/lib/services/proformaImport/article-matcher';
import { BestflowExtractor } from '@/lib/services/proformaImport/bestflow-extractor';
import { calculateSalesTrends } from '@/lib/services/salesTrends';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderItemInput {
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  currentStock: number;
  minimumStock: number;
  avgMonthlySales?: number | null;
  estimatedSaleTime?: number | null;
  unitWeight?: number | null;
  proformaUnitPrice?: number | null;
  proformaTotalPrice?: number | null;
  dbUnitPrice?: number | null;
  dbTotalPrice?: number | null;
  marginAbsolute?: number | null;
  marginPercent?: number | null;
}

export interface SupplierOrderListParams {
  status?: string;
  supplierId?: number;
}

export interface CreateSupplierOrderData {
  supplierId?: number | null;
  expectedDeliveryDate?: string;
  notes?: string;
  items: OrderItemInput[];
}

export interface UpdateSupplierOrderData {
  supplierId?: number | null;
  expectedDeliveryDate?: string;
  notes?: string;
  items?: OrderItemInput[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrderToDTO(o: any) {
  return {
    id: Number(o.id),
    orderNumber: o.order_number,
    supplierId: o.supplier_id,
    supplierName: o.supplier?.name || null,
    status: o.status,
    orderDate: o.order_date.toISOString(),
    expectedDeliveryDate: o.expected_delivery_date?.toISOString() || null,
    actualDeliveryDate: o.actual_delivery_date?.toISOString() || null,
    totalItems: o.total_items,
    totalQuantity: o.total_quantity,
    estimatedSaleTimeMonths: o.estimated_sale_time_months
      ? Number(o.estimated_sale_time_months)
      : null,
    notes: o.notes,
    createdAt: o.created_at.toISOString(),
    updatedAt: o.updated_at.toISOString(),
    createdBy: o.created_by,
    updatedBy: o.updated_by,
    items: o.supplier_order_items?.map(mapItemToDTO) || [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItemToDTO(item: any) {
  return {
    id: Number(item.id),
    articleId: Number(item.article_id),
    articleCode: item.article_code,
    articleDescription: item.article_description,
    quantity: item.quantity,
    currentStock: Number(item.current_stock),
    minimumStock: Number(item.minimum_stock),
    avgMonthlySales: item.avg_monthly_sales ? Number(item.avg_monthly_sales) : null,
    estimatedSaleTime: item.estimated_sale_time ? Number(item.estimated_sale_time) : null,
    receivedQuantity: item.received_quantity,
    unitWeight: item.unit_weight ? Number(item.unit_weight) : null,
    proformaUnitPrice: item.proforma_unit_price ? Number(item.proforma_unit_price) : null,
    proformaTotalPrice: item.proforma_total_price ? Number(item.proforma_total_price) : null,
    dbUnitPrice: item.db_unit_price ? Number(item.db_unit_price) : null,
    dbTotalPrice: item.db_total_price ? Number(item.db_total_price) : null,
    marginAbsolute: item.margin_absolute ? Number(item.margin_absolute) : null,
    marginPercent: item.margin_percent ? Number(item.margin_percent) : null,
  };
}

function calculateWeightedSaleTime(items: OrderItemInput[]) {
  let totalWeightedTime = 0;
  let totalQtyWithData = 0;
  items.forEach((item) => {
    if (item.estimatedSaleTime && isFinite(item.estimatedSaleTime)) {
      totalWeightedTime += item.estimatedSaleTime * item.quantity;
      totalQtyWithData += item.quantity;
    }
  });
  return totalQtyWithData > 0 ? totalWeightedTime / totalQtyWithData : null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function list(params: SupplierOrderListParams) {
  const where: Prisma.supplier_ordersWhereInput = {
    deleted_at: null,
  };

  if (params.status) {
    where.status = params.status;
  }

  if (params.supplierId) {
    where.supplier_id = params.supplierId;
  }

  const orders = await prisma.supplier_orders.findMany({
    where,
    include: {
      supplier: true,
      supplier_order_items: {
        include: { article: true },
      },
    },
    orderBy: { order_date: 'desc' },
  });

  return orders.map(mapOrderToDTO);
}

export async function getById(id: bigint) {
  const order = await prisma.supplier_orders.findUnique({
    where: { id },
    include: {
      supplier: true,
      supplier_order_items: {
        include: { article: true },
      },
    },
  });

  if (!order) {
    return null;
  }

  return mapOrderToDTO(order);
}

export async function create(data: CreateSupplierOrderData, userId: number, request: NextRequest) {
  if (!data.items || data.items.length === 0) {
    return { error: 'Debe incluir al menos un artículo', status: 400 };
  }

  // Generate order number
  const lastOrder = await prisma.supplier_orders.findFirst({
    orderBy: { id: 'desc' },
  });

  const nextNumber = lastOrder ? Number(lastOrder.id) + 1 : 1;
  const orderNumber = `PO-${String(nextNumber).padStart(6, '0')}`;

  const totalItems = data.items.length;
  const totalQuantity = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const avgSaleTime = calculateWeightedSaleTime(data.items);

  const order = await prisma.supplier_orders.create({
    data: {
      order_number: orderNumber,
      supplier_id: data.supplierId || null,
      status: 'draft',
      expected_delivery_date: data.expectedDeliveryDate
        ? new Date(data.expectedDeliveryDate)
        : null,
      total_items: totalItems,
      total_quantity: totalQuantity,
      estimated_sale_time_months: avgSaleTime,
      notes: data.notes || null,
      created_by: userId,
      updated_by: userId,
      supplier_order_items: {
        create: data.items.map((item) => ({
          article_id: BigInt(item.articleId),
          article_code: item.articleCode,
          article_description: item.articleDescription,
          quantity: item.quantity,
          current_stock: item.currentStock,
          minimum_stock: item.minimumStock,
          avg_monthly_sales: item.avgMonthlySales || null,
          estimated_sale_time: item.estimatedSaleTime || null,
          unit_weight: item.unitWeight || null,
          proforma_unit_price: item.proformaUnitPrice || null,
          proforma_total_price: item.proformaTotalPrice || null,
          db_unit_price: item.dbUnitPrice || null,
          db_total_price: item.dbTotalPrice || null,
          margin_absolute: item.marginAbsolute || null,
          margin_percent: item.marginPercent || null,
        })),
      },
    },
    include: {
      supplier: true,
      supplier_order_items: true,
    },
  });

  await logActivity({
    request,
    operation: OPERATIONS.SUPPLIER_ORDER_CREATE,
    description: `Pedido a proveedor ${order.order_number} creado${order.supplier ? ` para ${order.supplier.name}` : ''}`,
    entityType: 'supplier_order',
    entityId: order.id,
    details: {
      orderNumber: order.order_number,
      supplierName: order.supplier?.name || null,
      totalItems: order.total_items,
      totalQuantity: order.total_quantity,
    },
  });

  return {
    data: {
      id: Number(order.id),
      orderNumber: order.order_number,
      supplierId: order.supplier_id,
      supplierName: order.supplier?.name || null,
      status: order.status,
      totalItems: order.total_items,
      totalQuantity: order.total_quantity,
    },
    status: 201,
  };
}

export async function update(
  id: bigint,
  data: UpdateSupplierOrderData,
  userId: number,
  request: NextRequest
) {
  if (data.items && Array.isArray(data.items)) {
    // Delete existing items and create new ones
    await prisma.supplier_order_items.deleteMany({
      where: { supplier_order_id: id },
    });

    const totalItems = data.items.length;
    const totalQuantity = data.items.reduce((sum, item) => sum + item.quantity, 0);
    const avgSaleTime = calculateWeightedSaleTime(data.items);

    const order = await prisma.supplier_orders.update({
      where: { id },
      data: {
        supplier_id: data.supplierId !== undefined ? data.supplierId : undefined,
        expected_delivery_date: data.expectedDeliveryDate
          ? new Date(data.expectedDeliveryDate)
          : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
        total_items: totalItems,
        total_quantity: totalQuantity,
        estimated_sale_time_months: avgSaleTime,
        updated_by: userId,
        supplier_order_items: {
          create: data.items.map((item) => ({
            article_id: BigInt(item.articleId),
            article_code: item.articleCode,
            article_description: item.articleDescription,
            quantity: item.quantity,
            current_stock: item.currentStock,
            minimum_stock: item.minimumStock,
            avg_monthly_sales: item.avgMonthlySales || null,
            estimated_sale_time: item.estimatedSaleTime || null,
            unit_weight: item.unitWeight || null,
            proforma_unit_price: item.proformaUnitPrice || null,
            proforma_total_price: item.proformaTotalPrice || null,
            db_unit_price: item.dbUnitPrice || null,
            db_total_price: item.dbTotalPrice || null,
            margin_absolute: item.marginAbsolute || null,
            margin_percent: item.marginPercent || null,
          })),
        },
      },
    });

    await logActivity({
      request,
      operation: OPERATIONS.SUPPLIER_ORDER_UPDATE,
      description: `Pedido a proveedor ${order.order_number} actualizado con ${totalItems} artículos`,
      entityType: 'supplier_order',
      entityId: order.id,
      details: {
        orderNumber: order.order_number,
        totalItems: order.total_items,
        totalQuantity: order.total_quantity,
      },
    });

    return {
      data: {
        id: Number(order.id),
        orderNumber: order.order_number,
        status: order.status,
        totalItems: order.total_items,
        totalQuantity: order.total_quantity,
      },
      status: 200,
    };
  } else {
    // Just update order metadata
    const order = await prisma.supplier_orders.update({
      where: { id },
      data: {
        supplier_id: data.supplierId ?? undefined,
        expected_delivery_date: data.expectedDeliveryDate
          ? new Date(data.expectedDeliveryDate)
          : undefined,
        notes: data.notes ?? undefined,
        updated_by: userId,
      },
    });

    await logActivity({
      request,
      operation: OPERATIONS.SUPPLIER_ORDER_UPDATE,
      description: `Pedido a proveedor ${order.order_number} actualizado`,
      entityType: 'supplier_order',
      entityId: order.id,
      details: { orderNumber: order.order_number },
    });

    return {
      data: {
        id: Number(order.id),
        orderNumber: order.order_number,
        status: order.status,
      },
      status: 200,
    };
  }
}

export async function remove(id: bigint, userId: number, request: NextRequest) {
  const order = await prisma.supplier_orders.findUnique({
    where: { id },
    include: { supplier: true },
  });

  if (!order) {
    return { error: 'Pedido no encontrado', status: 404 };
  }

  await prisma.supplier_orders.update({
    where: { id },
    data: {
      deleted_at: new Date(),
      updated_by: userId,
    },
  });

  await logActivity({
    request,
    operation: OPERATIONS.SUPPLIER_ORDER_DELETE,
    description: `Pedido a proveedor ${order.order_number} eliminado`,
    entityType: 'supplier_order',
    entityId: order.id,
    details: {
      orderNumber: order.order_number,
      supplierName: order.supplier?.name || null,
    },
  });

  return { status: 200 };
}

export async function updateStatus(
  id: bigint,
  status: string,
  userId: number,
  request: NextRequest
) {
  const validStatuses = ['draft', 'confirmed', 'sent', 'in_transit', 'received', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return { error: 'Estado inválido', status: 400 };
  }

  const updateData: Prisma.supplier_ordersUpdateInput = {
    status,
    updated_by: userId,
  };

  if (status === 'received') {
    updateData.actual_delivery_date = new Date();
  }

  const previousOrder = await prisma.supplier_orders.findUnique({
    where: { id },
    select: { status: true, order_number: true },
  });

  const order = await prisma.supplier_orders.update({
    where: { id },
    data: updateData,
  });

  await logActivity({
    request,
    operation: OPERATIONS.SUPPLIER_ORDER_STATUS_CHANGE,
    description: `Estado de pedido ${order.order_number} cambiado de ${previousOrder?.status || 'N/A'} a ${status}`,
    entityType: 'supplier_order',
    entityId: order.id,
    details: {
      orderNumber: order.order_number,
      previousStatus: previousOrder?.status,
      newStatus: status,
    },
  });

  return {
    data: {
      id: Number(order.id),
      orderNumber: order.order_number,
      status: order.status,
      actualDeliveryDate: order.actual_delivery_date?.toISOString() || null,
    },
    status: 200,
  };
}

export async function syncData(
  orderId: bigint,
  cifPercentage: number | null,
  userId: number,
  request: NextRequest
) {
  const order = await prisma.supplier_orders.findUnique({
    where: { id: orderId },
    include: { supplier_order_items: true },
  });

  if (!order) {
    return { error: 'Pedido no encontrado', status: 404 };
  }

  const itemsToSync = order.supplier_order_items.filter(
    (item) =>
      (item.unit_weight !== null && Number(item.unit_weight) > 0) ||
      (item.proforma_unit_price !== null && Number(item.proforma_unit_price) > 0)
  );

  if (itemsToSync.length === 0) {
    return {
      data: { updatedCount: 0, updates: [] },
      status: 200,
    };
  }

  let updatedCount = 0;
  const updates: {
    articleCode: string;
    newWeight?: number;
    newPurchasePrice?: number;
    newCifPercentage?: number;
  }[] = [];

  for (const item of itemsToSync) {
    const updateData: {
      weight_kg?: number;
      last_purchase_price?: number;
      cif_percentage?: number;
      updated_at: Date;
      updated_by?: number;
    } = {
      updated_at: new Date(),
      updated_by: userId,
    };

    const updateInfo: {
      articleCode: string;
      newWeight?: number;
      newPurchasePrice?: number;
      newCifPercentage?: number;
    } = { articleCode: item.article_code };

    if (item.unit_weight !== null && Number(item.unit_weight) > 0) {
      const newWeight = Number(item.unit_weight);
      updateData.weight_kg = newWeight;
      updateInfo.newWeight = newWeight;
    }

    if (item.proforma_unit_price !== null && Number(item.proforma_unit_price) > 0) {
      const newPurchasePrice = Number(item.proforma_unit_price);
      updateData.last_purchase_price = newPurchasePrice;
      updateInfo.newPurchasePrice = newPurchasePrice;
    }

    if (cifPercentage !== null && cifPercentage > 0) {
      updateData.cif_percentage = cifPercentage;
      updateInfo.newCifPercentage = cifPercentage;
    }

    if (
      updateData.weight_kg !== undefined ||
      updateData.last_purchase_price !== undefined ||
      updateData.cif_percentage !== undefined
    ) {
      await prisma.articles.update({
        where: { id: item.article_id },
        data: updateData,
      });

      updates.push(updateInfo);
      updatedCount++;
    }
  }

  await logActivity({
    request,
    operation: OPERATIONS.ARTICLE_UPDATE,
    description: `Datos sincronizados desde pedido ${order.order_number}: ${updatedCount} artículos actualizados`,
    entityType: 'supplier_order',
    entityId: orderId,
    details: {
      orderNumber: order.order_number,
      cifPercentage,
      updatedArticles: updates,
    },
  });

  return {
    data: { updatedCount, updates },
    status: 200,
  };
}

export async function syncWeights(orderId: bigint, userId: number, request: NextRequest) {
  const order = await prisma.supplier_orders.findUnique({
    where: { id: orderId },
    include: { supplier_order_items: true },
  });

  if (!order) {
    return { error: 'Pedido no encontrado', status: 404 };
  }

  const itemsWithWeight = order.supplier_order_items.filter(
    (item) => item.unit_weight !== null && Number(item.unit_weight) > 0
  );

  if (itemsWithWeight.length === 0) {
    return {
      data: { updatedCount: 0, updates: [] },
      status: 200,
    };
  }

  let updatedCount = 0;
  const updates: { articleCode: string; newWeight: number }[] = [];

  for (const item of itemsWithWeight) {
    const newWeight = Number(item.unit_weight);

    await prisma.articles.update({
      where: { id: item.article_id },
      data: {
        weight_kg: newWeight,
        updated_at: new Date(),
        updated_by: userId,
      },
    });

    updates.push({ articleCode: item.article_code, newWeight });
    updatedCount++;
  }

  await logActivity({
    request,
    operation: OPERATIONS.ARTICLE_UPDATE,
    description: `Pesos unitarios sincronizados desde pedido ${order.order_number}: ${updatedCount} artículos actualizados`,
    entityType: 'supplier_order',
    entityId: orderId,
    details: {
      orderNumber: order.order_number,
      updatedArticles: updates,
    },
  });

  return {
    data: { updatedCount, updates },
    status: 200,
  };
}

export async function importProforma(file: File, request: NextRequest) {
  // Validate file type
  if (!file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
    return { error: 'Only Excel files (.xls, .xlsx) are supported', status: 400 };
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { error: 'File size exceeds 5MB limit', status: 400 };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const extractor = new BestflowExtractor();
  const proformaData = await extractor.extract(buffer, file.name);

  if (proformaData.items.length === 0) {
    return { error: 'No items found in the proforma file', status: 400 };
  }

  const matcher = new ArticleMatcher(prisma);
  const matchedItems = await matcher.matchItems(proformaData.items);
  await matcher.cleanup();

  // Load sales trends for matched articles
  const matchedArticleIds = matchedItems
    .filter((m) => m.article !== null)
    .map((m) => m.article!.id.toString());

  let salesTrendsData: Map<string, number[]> | null = null;
  if (matchedArticleIds.length > 0) {
    const trendsResult = await calculateSalesTrends(12);
    salesTrendsData = trendsResult.data;
  }

  // Enrich matched items with sales trends
  const enrichedItems = matchedItems.map((item) => {
    if (item.article && salesTrendsData) {
      const salesTrend = salesTrendsData.get(item.article.id.toString()) || [];
      return {
        ...item,
        article: { ...item.article, salesTrend },
      };
    }
    return item;
  });

  const matched = enrichedItems.filter((m) => m.confidence >= 70).length;
  const needsReview = enrichedItems.filter((m) => m.confidence >= 50 && m.confidence < 70).length;
  const unmatched = enrichedItems.filter((m) => m.confidence < 50).length;

  await logActivity({
    request,
    operation: OPERATIONS.SUPPLIER_ORDER_IMPORT,
    description: `Proforma importada: ${file.name} (${enrichedItems.length} artículos, ${matched} coincidencias)`,
    entityType: 'supplier_order',
    details: {
      fileName: file.name,
      totalItems: enrichedItems.length,
      matched,
      needsReview,
      unmatched,
    },
  });

  return {
    data: {
      proforma: proformaData.metadata,
      items: enrichedItems,
      summary: { total: enrichedItems.length, matched, needsReview, unmatched },
    },
    status: 200,
  };
}
