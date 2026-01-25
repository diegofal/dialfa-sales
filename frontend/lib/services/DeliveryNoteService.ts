import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma } from '@/lib/db';
import { loadTemplate } from '@/lib/print-templates/template-loader';
import { logActivity } from '@/lib/utils/activityLogger';
import { ChangeTracker } from '@/lib/utils/changeTracker';
import { mapDeliveryNoteToDTO } from '@/lib/utils/mapper';
import { pdfService } from '@/lib/utils/pdfGenerator';
import { createDeliveryNoteSchema, updateDeliveryNoteSchema } from '@/lib/validations/schemas';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeliveryNoteListParams {
  page: number;
  limit: number;
  salesOrderId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface CreateDeliveryNoteData {
  salesOrderId: number;
  deliveryDate: Date;
  transporterId?: number;
  weightKg?: number;
  packagesCount?: number;
  declaredValue?: number;
  notes?: string;
  items: Array<{
    salesOrderItemId: number;
    articleId: number;
    articleCode: string;
    articleDescription: string;
    quantity: number;
  }>;
}

export interface UpdateDeliveryNoteData {
  deliveryDate?: Date;
  transporterId?: number;
  weightKg?: number;
  packagesCount?: number;
  declaredValue?: number;
  notes?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function list(params: DeliveryNoteListParams) {
  const { page, limit, salesOrderId, fromDate, toDate } = params;
  const skip = (page - 1) * limit;

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

  const mappedDeliveryNotes = deliveryNotes.map((dn) => mapDeliveryNoteToDTO(dn));

  return {
    data: mappedDeliveryNotes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getById(id: bigint) {
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
    return null;
  }

  return mapDeliveryNoteToDTO(deliveryNote);
}

export async function create(body: unknown, request: NextRequest) {
  const validatedData = createDeliveryNoteSchema.parse(body);

  // Check if sales order exists
  const salesOrder = await prisma.sales_orders.findUnique({
    where: { id: validatedData.salesOrderId },
    include: {
      delivery_notes: {
        where: { deleted_at: null },
      },
      sales_order_items: {
        include: { articles: true },
      },
    },
  });

  if (!salesOrder || salesOrder.deleted_at) {
    return { error: 'Sales order not found', status: 404 };
  }

  if (!validatedData.items || validatedData.items.length === 0) {
    return { error: 'Delivery note must have at least one item', status: 400 };
  }

  // Generate delivery number (format: REM-YYYYMMDD-XXXX)
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

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

    return tx.delivery_notes.findUnique({
      where: { id: newDeliveryNote.id },
      include: {
        sales_orders: {
          include: { clients: true },
        },
        transporters: true,
        delivery_note_items: true,
      },
    });
  });

  if (!deliveryNote) {
    throw new Error('Failed to create delivery note');
  }

  const mappedDeliveryNote = mapDeliveryNoteToDTO(deliveryNote);

  await logActivity({
    request,
    operation: OPERATIONS.DELIVERY_CREATE,
    description: `Remito ${deliveryNote.delivery_number} creado para pedido ${deliveryNote.sales_orders.order_number}`,
    entityType: 'delivery_note',
    entityId: deliveryNote.id,
    details: {
      deliveryNumber: deliveryNote.delivery_number,
      orderNumber: deliveryNote.sales_orders.order_number,
    },
  });

  return { data: mappedDeliveryNote, status: 201 };
}

export async function update(id: bigint, body: unknown, request: NextRequest) {
  const existingDeliveryNote = await prisma.delivery_notes.findUnique({
    where: { id },
  });

  if (!existingDeliveryNote || existingDeliveryNote.deleted_at) {
    return { error: 'Delivery note not found', status: 404 };
  }

  const validatedData = updateDeliveryNoteSchema.parse(body);

  const tracker = new ChangeTracker();
  await tracker.trackBefore('delivery_note', id);

  const now = new Date();

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
        include: { clients: true },
      },
      transporters: true,
    },
  });

  const mappedDeliveryNote = mapDeliveryNoteToDTO(deliveryNote);

  await tracker.trackAfter('delivery_note', id);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.DELIVERY_UPDATE,
    description: `Remito ${existingDeliveryNote.delivery_number} actualizado`,
    entityType: 'delivery_note',
    entityId: id,
    details: { deliveryNumber: existingDeliveryNote.delivery_number },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return { data: mappedDeliveryNote, status: 200 };
}

export async function remove(id: bigint, request: NextRequest) {
  const existingDeliveryNote = await prisma.delivery_notes.findUnique({
    where: { id },
  });

  if (!existingDeliveryNote || existingDeliveryNote.deleted_at) {
    return { error: 'Delivery note not found', status: 404 };
  }

  const tracker = new ChangeTracker();
  tracker.trackDelete('delivery_note', id, existingDeliveryNote);

  const now = new Date();

  await prisma.delivery_notes.update({
    where: { id },
    data: {
      deleted_at: now,
      updated_at: now,
    },
  });

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.DELIVERY_DELETE,
    description: `Remito ${existingDeliveryNote.delivery_number} eliminado`,
    entityType: 'delivery_note',
    entityId: id,
    details: { deliveryNumber: existingDeliveryNote.delivery_number },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return { status: 200 };
}

export async function print(id: bigint, request: NextRequest) {
  const deliveryNote = await prisma.delivery_notes.findUnique({
    where: { id },
    include: {
      sales_orders: {
        include: {
          clients: {
            include: {
              provinces: true,
              tax_conditions: true,
            },
          },
        },
      },
      transporters: true,
      delivery_note_items: {
        orderBy: { id: 'asc' },
      },
    },
  });

  if (!deliveryNote || deliveryNote.deleted_at) {
    return { error: 'Delivery note not found', status: 404 };
  }

  const template = await loadTemplate('delivery-note', 'default');
  const pdfBuffer = await pdfService.generateDeliveryNotePDF(deliveryNote, template);

  // Mark as printed (only first time)
  const tracker = new ChangeTracker();
  await tracker.trackBefore('delivery_note', id);

  const now = new Date();
  const isPrintingNow = !deliveryNote.is_printed;

  if (isPrintingNow) {
    await prisma.delivery_notes.update({
      where: { id },
      data: {
        is_printed: true,
        printed_at: now,
        updated_at: now,
      },
    });
  }

  await tracker.trackAfter('delivery_note', id);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.DELIVERY_PRINT,
    description: `Remito ${deliveryNote.delivery_number} impreso`,
    entityType: 'delivery_note',
    entityId: id,
    details: { deliveryNumber: deliveryNote.delivery_number },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return { data: pdfBuffer, status: 200 };
}

export async function getPDF(id: bigint) {
  const deliveryNote = await prisma.delivery_notes.findUnique({
    where: { id },
    include: {
      sales_orders: {
        include: {
          clients: {
            include: {
              provinces: true,
              tax_conditions: true,
            },
          },
        },
      },
      transporters: true,
      delivery_note_items: {
        orderBy: { id: 'asc' },
      },
    },
  });

  if (!deliveryNote || deliveryNote.deleted_at) {
    return null;
  }

  const template = await loadTemplate('delivery-note', 'default');
  return pdfService.generateDeliveryNotePDF(deliveryNote, template);
}
