import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth/roles';
import { logActivity } from '@/lib/services/activityLogger';
import { OPERATIONS } from '@/lib/constants/operations';

export async function PATCH(
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
    const { status } = body;

    const validStatuses = ['draft', 'confirmed', 'sent', 'in_transit', 'received', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Estado inválido' },
        { status: 400 }
      );
    }

    const updateData: Prisma.supplier_ordersUpdateInput = {
      status,
      updated_by: user.userId,
    };

    // Set actual delivery date when received
    if (status === 'received') {
      updateData.actual_delivery_date = new Date();
    }

    // Get previous status for logging
    const previousOrder = await prisma.supplier_orders.findUnique({
      where: { id },
      select: { status: true, order_number: true },
    });

    const order = await prisma.supplier_orders.update({
      where: { id },
      data: updateData,
    });

    // Log activity
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

    return NextResponse.json({
      success: true,
      data: {
        id: Number(order.id),
        orderNumber: order.order_number,
        status: order.status,
        actualDeliveryDate: order.actual_delivery_date?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error updating supplier order status:', error);
    return NextResponse.json(
      { error: 'Error al actualizar estado del pedido' },
      { status: 500 }
    );
  }
}


