import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Generate a delivery note from a sales order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const salesOrderId = BigInt(idStr);

    // Fetch the sales order
    const salesOrder = await prisma.sales_orders.findUnique({
      where: { id: salesOrderId },
      include: {
        clients: true,
        delivery_notes: {
          where: {
            deleted_at: null,
          },
        },
      },
    });

    if (!salesOrder || salesOrder.deleted_at) {
      return NextResponse.json(
        { error: 'Pedido no encontrado' },
        { status: 404 }
      );
    }

    // Check if already has a delivery note
    if (salesOrder.delivery_notes.length > 0) {
      return NextResponse.json(
        { error: 'El pedido ya tiene un remito asociado' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Generate delivery note number (format: REM-YYYYMMDD-XXXX)
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of delivery notes today to generate sequence
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const todayNotesCount = await prisma.delivery_notes.count({
      where: {
        delivery_date: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });
    
    const sequence = String(todayNotesCount + 1).padStart(4, '0');
    const deliveryNumber = `REM-${dateStr}-${sequence}`;

    // Get optional data from request body
    const body = await request.json().catch(() => ({}));
    const {
      deliveryDate = now,
      transporterId = null,
      weightKg = null,
      packagesCount = null,
      declaredValue = null,
      notes = null,
    } = body;

    // Create delivery note
    const deliveryNote = await prisma.delivery_notes.create({
      data: {
        delivery_number: deliveryNumber,
        sales_order_id: salesOrderId,
        delivery_date: deliveryDate,
        transporter_id: transporterId,
        weight_kg: weightKg,
        packages_count: packagesCount,
        declared_value: declaredValue,
        notes: notes || salesOrder.notes,
        created_at: now,
        updated_at: now,
      },
      include: {
        sales_orders: {
          include: {
            clients: true,
          },
        },
        transporters: true,
      },
    });

    // Map to response format
    const response = {
      id: Number(deliveryNote.id),
      deliveryNumber: deliveryNote.delivery_number,
      salesOrderId: Number(deliveryNote.sales_order_id),
      salesOrderNumber: deliveryNote.sales_orders.order_number,
      clientBusinessName: deliveryNote.sales_orders.clients.business_name,
      deliveryDate: deliveryNote.delivery_date.toISOString(),
      transporterId: deliveryNote.transporter_id,
      transporterName: deliveryNote.transporters?.name ?? null,
      weightKg: deliveryNote.weight_kg ? parseFloat(deliveryNote.weight_kg.toString()) : null,
      packagesCount: deliveryNote.packages_count,
      declaredValue: deliveryNote.declared_value ? parseFloat(deliveryNote.declared_value.toString()) : null,
      notes: deliveryNote.notes,
      createdAt: deliveryNote.created_at.toISOString(),
      updatedAt: deliveryNote.updated_at.toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error generating delivery note:', error);
    return NextResponse.json(
      { error: 'Error al generar el remito' },
      { status: 500 }
    );
  }
}

