import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapDeliveryNoteToDTO } from '@/lib/utils/mapper';
import { createDeliveryNoteSchema } from '@/lib/validations/schemas';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const salesOrderId = searchParams.get('salesOrderId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      deleted_at: null,
    };

    if (salesOrderId) {
      where.sales_order_id = BigInt(salesOrderId);
    }

    if (fromDate) {
      where.delivery_date = {
        ...where.delivery_date,
        gte: new Date(fromDate),
      };
    }

    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      where.delivery_date = {
        ...where.delivery_date,
        lte: endDate,
      };
    }

    // Get delivery notes with sales order and client
    const [deliveryNotes, total] = await Promise.all([
      prisma.delivery_notes.findMany({
        where,
        include: {
          sales_orders: {
            include: {
              clients: true,
            },
          },
          transporters: true,
          delivery_note_items: true,
        },
        orderBy: {
          delivery_date: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.delivery_notes.count({ where }),
    ]);

    // Map to DTO format (snake_case to camelCase)
    const mappedDeliveryNotes = deliveryNotes.map((dn) => {
      const mapped = mapDeliveryNoteToDTO(dn);
      return {
        ...mapped,
        itemsCount: (dn.delivery_note_items || []).length,
      };
    });

    return NextResponse.json({
      data: mappedDeliveryNotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching delivery notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delivery notes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = createDeliveryNoteSchema.parse(body);

    // Check if sales order exists
    const salesOrder = await prisma.sales_orders.findUnique({
      where: { id: validatedData.salesOrderId },
      include: {
        delivery_notes: {
          where: {
            deleted_at: null,
          },
        },
        sales_order_items: {
          include: {
            articles: true,
          },
        },
      },
    });

    if (!salesOrder || salesOrder.deleted_at) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Validate that items match sales order items
    if (!validatedData.items || validatedData.items.length === 0) {
      return NextResponse.json(
        { error: 'Delivery note must have at least one item' },
        { status: 400 }
      );
    }

    // Generate delivery number (format: REM-YYYYMMDD-XXXX)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of delivery notes today to generate sequence
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const todayDeliveryNotesCount = await prisma.delivery_notes.count({
      where: {
        delivery_date: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });
    
    const sequence = String(todayDeliveryNotesCount + 1).padStart(4, '0');
    const deliveryNumber = `REM-${dateStr}-${sequence}`;

    // Create delivery note with items in a transaction
    const deliveryNote = await prisma.$transaction(async (tx) => {
      // Create delivery note
      const newDeliveryNote = await tx.delivery_notes.create({
        data: {
          delivery_number: deliveryNumber,
          sales_order_id: validatedData.salesOrderId,
          delivery_date: validatedData.deliveryDate,
          transporter_id: validatedData.transporterId,
          weight_kg: validatedData.weightKg,
          packages_count: validatedData.packagesCount,
          declared_value: validatedData.declaredValue,
          notes: validatedData.notes,
          created_at: now,
          updated_at: now,
        },
      });

      // Create delivery note items
      await tx.delivery_note_items.createMany({
        data: validatedData.items.map((item) => ({
          delivery_note_id: newDeliveryNote.id,
          sales_order_item_id: item.salesOrderItemId,
          article_id: BigInt(item.articleId),
          article_code: item.articleCode,
          article_description: item.articleDescription,
          quantity: item.quantity,
          created_at: now,
        })),
      });

      // Return complete delivery note with all includes
      return tx.delivery_notes.findUnique({
        where: { id: newDeliveryNote.id },
        include: {
          sales_orders: {
            include: {
              clients: true,
            },
          },
          transporters: true,
          delivery_note_items: true,
        },
      });
    });

    if (!deliveryNote) {
      throw new Error('Failed to create delivery note');
    }

    // Map to DTO format
    const mappedDeliveryNote = mapDeliveryNoteToDTO(deliveryNote);

    return NextResponse.json(mappedDeliveryNote, { status: 201 });
  } catch (error) {
    console.error('Error creating delivery note:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create delivery note' },
      { status: 500 }
    );
  }
}






