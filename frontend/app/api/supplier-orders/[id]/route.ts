import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = BigInt(idParam);
    const order = await prisma.supplier_orders.findUnique({
      where: { id },
      include: {
        supplier: true,
        supplier_order_items: {
          include: {
            article: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Pedido no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: Number(order.id),
        orderNumber: order.order_number,
        supplierId: order.supplier_id,
        supplierName: order.supplier?.name || null,
        status: order.status,
        orderDate: order.order_date.toISOString(),
        expectedDeliveryDate: order.expected_delivery_date?.toISOString() || null,
        actualDeliveryDate: order.actual_delivery_date?.toISOString() || null,
        totalItems: order.total_items,
        totalQuantity: order.total_quantity,
        estimatedSaleTimeMonths: order.estimated_sale_time_months ? Number(order.estimated_sale_time_months) : null,
        notes: order.notes,
        createdAt: order.created_at.toISOString(),
        updatedAt: order.updated_at.toISOString(),
        items: order.supplier_order_items.map((item) => ({
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
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching supplier order:', error);
    return NextResponse.json(
      { error: 'Error al obtener pedido' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = BigInt(idParam);
    const body = await request.json();
    const { supplierId, expectedDeliveryDate, notes, items } = body;

    // If items are provided, update them too
    if (items && Array.isArray(items)) {
      // Delete existing items and create new ones
      await prisma.supplier_order_items.deleteMany({
        where: { supplier_order_id: id },
      });

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

      // Update order with new items
      const order = await prisma.supplier_orders.update({
        where: { id },
        data: {
          supplier_id: supplierId !== undefined ? supplierId : undefined,
          expected_delivery_date: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
          notes: notes !== undefined ? notes : undefined,
          total_items: totalItems,
          total_quantity: totalQuantity,
          estimated_sale_time_months: avgSaleTime,
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
            })),
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: Number(order.id),
          orderNumber: order.order_number,
          status: order.status,
          totalItems: order.total_items,
          totalQuantity: order.total_quantity,
        },
      });
    } else {
      // Just update order metadata
      const order = await prisma.supplier_orders.update({
        where: { id },
        data: {
          supplier_id: supplierId ?? undefined,
          expected_delivery_date: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
          notes: notes ?? undefined,
          updated_by: user.userId,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: Number(order.id),
          orderNumber: order.order_number,
          status: order.status,
        },
      });
    }
  } catch (error) {
    console.error('Error updating supplier order:', error);
    return NextResponse.json(
      { error: 'Error al actualizar pedido' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = BigInt(idParam);

    // Soft delete
    await prisma.supplier_orders.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_by: user.userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Pedido eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error deleting supplier order:', error);
    return NextResponse.json(
      { error: 'Error al eliminar pedido' },
      { status: 500 }
    );
  }
}

