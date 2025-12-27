import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth/roles';

interface OrderItemInput {
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  currentStock: number;
  minimumStock: number;
  avgMonthlySales?: number | null;
  estimatedSaleTime?: number | null;
  // Valorización
  unitWeight?: number | null;
  proformaUnitPrice?: number | null;
  proformaTotalPrice?: number | null;
  dbUnitPrice?: number | null;
  dbTotalPrice?: number | null;
  marginAbsolute?: number | null;
  marginPercent?: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const supplierId = searchParams.get('supplierId') ? parseInt(searchParams.get('supplierId')!) : undefined;

    const where: Prisma.supplier_ordersWhereInput = {
      deleted_at: null,
    };

    if (status) {
      where.status = status;
    }

    if (supplierId) {
      where.supplier_id = supplierId;
    }

    const orders = await prisma.supplier_orders.findMany({
      where,
      include: {
        supplier: true,
        supplier_order_items: {
          include: {
            article: true,
          },
        },
      },
      orderBy: { order_date: 'desc' },
    });

    const dto = orders.map((o) => ({
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
      estimatedSaleTimeMonths: o.estimated_sale_time_months ? Number(o.estimated_sale_time_months) : null,
      notes: o.notes,
      createdAt: o.created_at.toISOString(),
      updatedAt: o.updated_at.toISOString(),
      createdBy: o.created_by,
      updatedBy: o.updated_by,
      items: o.supplier_order_items.map((item) => ({
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
        // Valorización
        unitWeight: item.unit_weight ? Number(item.unit_weight) : null,
        proformaUnitPrice: item.proforma_unit_price ? Number(item.proforma_unit_price) : null,
        proformaTotalPrice: item.proforma_total_price ? Number(item.proforma_total_price) : null,
        dbUnitPrice: item.db_unit_price ? Number(item.db_unit_price) : null,
        dbTotalPrice: item.db_total_price ? Number(item.db_total_price) : null,
        marginAbsolute: item.margin_absolute ? Number(item.margin_absolute) : null,
        marginPercent: item.margin_percent ? Number(item.margin_percent) : null,
      })),
    }));

    return NextResponse.json({
      success: true,
      data: dto,
      total: dto.length,
    });
  } catch (error) {
    console.error('Error fetching supplier orders:', error);
    return NextResponse.json(
      { error: 'Error al obtener pedidos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { supplierId, expectedDeliveryDate, notes, items } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Debe incluir al menos un artículo' },
        { status: 400 }
      );
    }

    // Generate order number
    const lastOrder = await prisma.supplier_orders.findFirst({
      orderBy: { id: 'desc' },
    });
    
    const nextNumber = lastOrder ? Number(lastOrder.id) + 1 : 1;
    const orderNumber = `PO-${String(nextNumber).padStart(6, '0')}`;

    // Calculate totals
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum: number, item: OrderItemInput) => sum + item.quantity, 0);
    
    // Calculate weighted average sale time
    let totalWeightedTime = 0;
    let totalQtyWithData = 0;
    items.forEach((item: OrderItemInput) => {
      if (item.estimatedSaleTime && isFinite(item.estimatedSaleTime)) {
        totalWeightedTime += item.estimatedSaleTime * item.quantity;
        totalQtyWithData += item.quantity;
      }
    });
    const avgSaleTime = totalQtyWithData > 0 ? totalWeightedTime / totalQtyWithData : null;

    // Create order with items
    const order = await prisma.supplier_orders.create({
      data: {
        order_number: orderNumber,
        supplier_id: supplierId || null,
        status: 'draft',
        expected_delivery_date: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        total_items: totalItems,
        total_quantity: totalQuantity,
        estimated_sale_time_months: avgSaleTime,
        notes: notes || null,
        created_by: user.userId,
        updated_by: user.userId,
        supplier_order_items: {
          create: items.map((item: OrderItemInput) => ({
            article_id: BigInt(item.articleId),
            article_code: item.articleCode,
            article_description: item.articleDescription,
            quantity: item.quantity,
            current_stock: item.currentStock,
            minimum_stock: item.minimumStock,
            avg_monthly_sales: item.avgMonthlySales || null,
            estimated_sale_time: item.estimatedSaleTime || null,
            // Valorización
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

    return NextResponse.json({
      success: true,
      data: {
        id: Number(order.id),
        orderNumber: order.order_number,
        supplierId: order.supplier_id,
        supplierName: order.supplier?.name || null,
        status: order.status,
        totalItems: order.total_items,
        totalQuantity: order.total_quantity,
      },
    });
  } catch (error) {
    console.error('Error creating supplier order:', error);
    return NextResponse.json(
      { error: 'Error al crear pedido' },
      { status: 500 }
    );
  }
}


