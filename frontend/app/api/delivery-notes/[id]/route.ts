import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapDeliveryNoteToDTO } from '@/lib/utils/mapper';
import { updateDeliveryNoteSchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    const deliveryNote = await prisma.delivery_notes.findUnique({
      where: { id },
      include: {
        sales_orders: {
          include: {
            clients: true,
          },
        },
        transporters: true,
        delivery_note_items: {
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!deliveryNote || deliveryNote.deleted_at) {
      return NextResponse.json(
        { error: 'Delivery note not found' },
        { status: 404 }
      );
    }

    // Map to DTO format (snake_case to camelCase)
    const mappedDeliveryNote = mapDeliveryNoteToDTO(deliveryNote);

    return NextResponse.json(mappedDeliveryNote);
  } catch (error) {
    console.error('Error fetching delivery note:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delivery note' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);
    const body = await request.json();

    // Check if delivery note exists and is not deleted
    const existingDeliveryNote = await prisma.delivery_notes.findUnique({
      where: { id },
    });

    if (!existingDeliveryNote || existingDeliveryNote.deleted_at) {
      return NextResponse.json(
        { error: 'Delivery note not found' },
        { status: 404 }
      );
    }

    // Validate input
    const validatedData = updateDeliveryNoteSchema.parse(body);

    const now = new Date();

    // Update delivery note
    const deliveryNote = await prisma.delivery_notes.update({
      where: { id },
      data: {
        delivery_date: validatedData.deliveryDate,
        transporter_id: validatedData.transporterId,
        weight_kg: validatedData.weightKg,
        packages_count: validatedData.packagesCount,
        declared_value: validatedData.declaredValue,
        notes: validatedData.notes,
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

    // Map to DTO format
    const mappedDeliveryNote = mapDeliveryNoteToDTO(deliveryNote);

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.DELIVERY_UPDATE,
      description: `Remito ${existingDeliveryNote.delivery_number} actualizado`,
      entityType: 'delivery_note',
      entityId: id,
      details: { deliveryNumber: existingDeliveryNote.delivery_number }
    });

    return NextResponse.json(mappedDeliveryNote);
  } catch (error) {
    console.error('Error updating delivery note:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update delivery note' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    // Check if delivery note exists and is not already deleted
    const existingDeliveryNote = await prisma.delivery_notes.findUnique({
      where: { id },
    });

    if (!existingDeliveryNote || existingDeliveryNote.deleted_at) {
      return NextResponse.json(
        { error: 'Delivery note not found' },
        { status: 404 }
      );
    }

    const now = new Date();

    // Soft delete delivery note
    await prisma.delivery_notes.update({
      where: { id },
      data: {
        deleted_at: now,
        updated_at: now,
      },
    });

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.DELIVERY_DELETE,
      description: `Remito ${existingDeliveryNote.delivery_number} eliminado`,
      entityType: 'delivery_note',
      entityId: id,
      details: { deliveryNumber: existingDeliveryNote.delivery_number }
    });

    return NextResponse.json(
      { message: 'Delivery note deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting delivery note:', error);
    return NextResponse.json(
      { error: 'Failed to delete delivery note' },
      { status: 500 }
    );
  }
}






