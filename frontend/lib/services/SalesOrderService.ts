import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { STOCK_MOVEMENT_TYPES } from '@/lib/constants/stockMovementTypes';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';
import { mapInvoiceToDTO, mapSalesOrderToDTO } from '@/lib/utils/mapper';
import { CreateSalesOrderInput, UpdateSalesOrderInput } from '@/lib/validations/schemas';
import { calculateSalesOrderPermissions as calculatePermissions } from '@/types/permissions';
import type { SalesOrderStatus } from '@/types/permissions';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalesOrderListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  clientId?: string;
}

export interface GenerateDeliveryNoteOptions {
  deliveryDate?: Date;
  transporterId?: bigint | null;
  weightKg?: number | null;
  packagesCount?: number | null;
  declaredValue?: number | null;
  notes?: string | null;
}

export interface DeleteResult {
  affectedInvoices: Array<{ id: string; invoiceNumber: string; wasCancelled: boolean }>;
  affectedDeliveryNotes: string[];
  orderNumber: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function list(params: SalesOrderListParams) {
  const { page, limit, search, status, clientId } = params;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { deleted_at: null };

  if (search) {
    where.OR = [{ order_number: { contains: search, mode: 'insensitive' } }];
  }
  if (status) {
    where.status = status;
  }
  if (clientId) {
    where.client_id = BigInt(clientId);
  }

  const [salesOrders, total] = await Promise.all([
    prisma.sales_orders.findMany({
      where,
      include: {
        clients: true,
        payment_terms: true,
        sales_order_items: {
          include: { articles: true },
        },
        invoices: {
          select: { id: true, invoice_number: true, is_printed: true, is_cancelled: true },
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { order_date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.sales_orders.count({ where }),
  ]);

  return {
    data: salesOrders.map(mapSalesOrderToDTO),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getById(id: bigint) {
  const salesOrder = await prisma.sales_orders.findUnique({
    where: { id },
    include: {
      clients: true,
      payment_terms: true,
      sales_order_items: {
        include: { articles: true },
        orderBy: { id: 'asc' },
      },
      invoices: {
        select: { id: true, invoice_number: true, is_printed: true, is_cancelled: true },
        where: { deleted_at: null },
        orderBy: { created_at: 'desc' },
        take: 1,
      },
      delivery_notes: {
        select: { id: true, delivery_number: true, delivery_date: true },
        where: { deleted_at: null },
        orderBy: { created_at: 'desc' },
        take: 1,
      },
    },
  });

  if (!salesOrder || salesOrder.deleted_at) {
    return null;
  }

  return mapSalesOrderToDTO(salesOrder);
}

export async function create(data: CreateSalesOrderInput, request: NextRequest) {
  const itemsData = data.items.map((item) => {
    const lineTotal = item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
    return {
      article_id: item.articleId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_percent: item.discountPercent,
      line_total: lineTotal,
    };
  });

  const subtotal = itemsData.reduce((sum, item) => sum + item.line_total, 0);
  const total = subtotal * (1 - data.specialDiscountPercent / 100);

  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

    const lastOrder = await tx.sales_orders.findFirst({
      where: { order_number: { startsWith: `SO-${dateStr}-` } },
      orderBy: { order_number: 'desc' },
      select: { order_number: true },
    });

    let sequence = 1;
    if (lastOrder) {
      sequence = parseInt(lastOrder.order_number.split('-')[2]) + 1;
    }
    const orderNumber = `SO-${dateStr}-${String(sequence).padStart(4, '0')}`;

    const salesOrder = await tx.sales_orders.create({
      data: {
        client_id: data.clientId,
        order_number: orderNumber,
        order_date: now,
        delivery_date: null,
        status: data.status || 'PENDING',
        payment_term_id: data.paymentTermId ?? null,
        special_discount_percent: data.specialDiscountPercent,
        total,
        notes: data.notes,
        created_at: now,
        updated_at: now,
      },
    });

    await tx.sales_order_items.createMany({
      data: itemsData.map((item) => ({
        ...item,
        sales_order_id: salesOrder.id,
        created_at: now,
      })),
    });

    return await tx.sales_orders.findUnique({
      where: { id: salesOrder.id },
      include: {
        clients: true,
        payment_terms: true,
        sales_order_items: { include: { articles: true } },
      },
    });
  });

  if (!result) {
    throw new Error('Failed to create sales order');
  }

  const mapped = mapSalesOrderToDTO(result);

  const tracker = new ChangeTracker();
  tracker.trackCreate('sales_order', result.id, result);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.ORDER_CREATE,
    description: `Pedido ${result.order_number} creado para cliente ${result.clients.business_name}`,
    entityType: 'sales_order',
    entityId: result.id,
    details: { total: Number(result.total), itemsCount: result.sales_order_items.length },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return mapped;
}

export async function update(id: bigint, data: UpdateSalesOrderInput, request: NextRequest) {
  const existingSalesOrder = await prisma.sales_orders.findUnique({
    where: { id },
    include: {
      invoices: {
        select: { id: true, is_printed: true, is_cancelled: true },
        where: { deleted_at: null },
        orderBy: { created_at: 'desc' },
        take: 1,
      },
    },
  });

  if (!existingSalesOrder || existingSalesOrder.deleted_at) {
    return null;
  }

  // Check permissions
  const activeInvoice = existingSalesOrder.invoices[0];
  if (activeInvoice && activeInvoice.is_printed && !activeInvoice.is_cancelled) {
    throw new Error('No se puede modificar un pedido con factura impresa activa');
  }

  const tracker = new ChangeTracker();
  await tracker.trackBefore('sales_order', id);

  const now = new Date();

  const unprintedInvoices = await prisma.invoices.findMany({
    where: { sales_order_id: id, is_printed: false, is_cancelled: false, deleted_at: null },
  });
  const unprintedDeliveryNotes = await prisma.delivery_notes.findMany({
    where: { sales_order_id: id, is_printed: false, deleted_at: null },
  });

  for (const invoice of unprintedInvoices) {
    await tracker.trackBefore('invoice', invoice.id);
  }
  for (const dn of unprintedDeliveryNotes) {
    await tracker.trackBefore('delivery_note', dn.id);
  }

  if (data.items && data.items.length > 0) {
    const itemsData = data.items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
      return {
        article_id: item.articleId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent,
        line_total: lineTotal,
      };
    });

    const subtotal = itemsData.reduce((sum, item) => sum + item.line_total, 0);
    const total = subtotal * (1 - (data.specialDiscountPercent ?? 0) / 100);

    const result = await prisma.$transaction(async (tx) => {
      await tx.sales_order_items.deleteMany({ where: { sales_order_id: id } });

      const salesOrder = await tx.sales_orders.update({
        where: { id },
        data: {
          client_id: data.clientId,
          payment_term_id: data.paymentTermId,
          status: data.status,
          special_discount_percent: data.specialDiscountPercent,
          total,
          notes: data.notes,
          updated_at: now,
        },
      });

      await tx.sales_order_items.createMany({
        data: itemsData.map((item) => ({
          ...item,
          sales_order_id: salesOrder.id,
          created_at: now,
        })),
      });

      const createdItems = await tx.sales_order_items.findMany({
        where: { sales_order_id: id },
        include: { articles: { include: { categories: true } } },
      });

      // Update unprinted invoices
      for (const invoice of unprintedInvoices) {
        const existingInvoiceItems = await tx.invoice_items.findMany({
          where: { invoice_id: invoice.id },
        });
        const existingDiscounts = new Map(
          existingInvoiceItems.map((item) => [
            item.article_id.toString(),
            parseFloat(item.discount_percent.toString()),
          ])
        );

        await tx.invoice_items.deleteMany({ where: { invoice_id: invoice.id } });

        const usdExchangeRate = invoice.usd_exchange_rate
          ? parseFloat(invoice.usd_exchange_rate.toString())
          : 1000;

        const TAX_RATE = 0.21;
        let netAmountArs = 0;

        const newInvoiceItems = createdItems.map((item) => {
          const unitPriceUsd = parseFloat(item.unit_price.toString());
          const unitPriceArs = unitPriceUsd * usdExchangeRate;
          const articleIdStr = item.article_id.toString();
          const discountPercent = existingDiscounts.has(articleIdStr)
            ? existingDiscounts.get(articleIdStr)!
            : item.articles.categories?.default_discount_percent
              ? parseFloat(item.articles.categories.default_discount_percent.toString())
              : 0;
          const quantity = item.quantity;
          const subtotalLine = unitPriceArs * quantity;
          const discount = subtotalLine * (discountPercent / 100);
          const lineTotal = subtotalLine - discount;
          netAmountArs += lineTotal;

          return {
            invoice_id: invoice.id,
            article_id: item.article_id,
            article_code: item.articles.code,
            article_description: item.articles.description,
            quantity,
            unit_price_usd: unitPriceUsd,
            unit_price_ars: unitPriceArs,
            discount_percent: discountPercent,
            line_total: lineTotal,
            created_at: now,
          };
        });

        const taxAmount = netAmountArs * TAX_RATE;
        const totalAmount = netAmountArs + taxAmount;

        await tx.invoice_items.createMany({ data: newInvoiceItems });
        await tx.invoices.update({
          where: { id: invoice.id },
          data: {
            net_amount: netAmountArs,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            updated_at: now,
          },
        });
      }

      // Update unprinted delivery notes
      for (const deliveryNote of unprintedDeliveryNotes) {
        await tx.delivery_note_items.deleteMany({ where: { delivery_note_id: deliveryNote.id } });
        await tx.delivery_note_items.createMany({
          data: createdItems.map((item) => ({
            delivery_note_id: deliveryNote.id,
            article_id: item.article_id,
            article_code: item.articles.code,
            article_description: item.articles.description,
            quantity: item.quantity,
            created_at: now,
          })),
        });
        await tx.delivery_notes.update({
          where: { id: deliveryNote.id },
          data: { updated_at: now },
        });
      }

      return await tx.sales_orders.findUnique({
        where: { id: salesOrder.id },
        include: { clients: true, sales_order_items: { include: { articles: true } } },
      });
    });

    if (!result) {
      throw new Error('Failed to update sales order');
    }

    await tracker.trackAfter('sales_order', id);
    for (const invoice of unprintedInvoices) {
      await tracker.trackAfter('invoice', invoice.id);
    }
    for (const dn of unprintedDeliveryNotes) {
      await tracker.trackAfter('delivery_note', dn.id);
    }

    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.ORDER_UPDATE,
      description: `Pedido ${result.order_number} actualizado para cliente ${result.clients.business_name}`,
      entityType: 'sales_order',
      entityId: id,
      details: { total: Number(result.total), itemsCount: result.sales_order_items.length },
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

    const updateInfo =
      unprintedInvoices.length > 0 || unprintedDeliveryNotes.length > 0
        ? {
            invoices: unprintedInvoices.length,
            deliveryNotes: unprintedDeliveryNotes.length,
            message: `Se actualizaron automáticamente ${unprintedInvoices.length} factura(s) y ${unprintedDeliveryNotes.length} remito(s) no impreso(s)`,
          }
        : undefined;

    return { ...mapSalesOrderToDTO(result), regenerated: updateInfo };
  } else {
    // Update only order fields without items
    const salesOrder = await prisma.sales_orders.update({
      where: { id },
      data: {
        client_id: data.clientId,
        status: data.status,
        special_discount_percent: data.specialDiscountPercent,
        notes: data.notes,
        updated_at: now,
      },
      include: { clients: true, sales_order_items: { include: { articles: true } } },
    });

    await tracker.trackAfter('sales_order', id);

    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.ORDER_UPDATE,
      description: `Pedido ${salesOrder.order_number} actualizado para cliente ${salesOrder.clients.business_name}`,
      entityType: 'sales_order',
      entityId: id,
      details: { total: Number(salesOrder.total), itemsCount: salesOrder.sales_order_items.length },
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

    return mapSalesOrderToDTO(salesOrder);
  }
}

export async function remove(id: bigint, request: NextRequest): Promise<DeleteResult | null> {
  const existingSalesOrder = await prisma.sales_orders.findUnique({
    where: { id },
    include: {
      invoices: { where: { deleted_at: null }, orderBy: { created_at: 'desc' } },
      delivery_notes: { where: { deleted_at: null } },
      sales_order_items: { include: { articles: true } },
    },
  });

  if (!existingSalesOrder || existingSalesOrder.deleted_at) {
    return null;
  }

  const tracker = new ChangeTracker();
  tracker.trackDelete('sales_order', id, existingSalesOrder);

  const now = new Date();
  const affectedDeliveryNoteIds: string[] = [];
  const cancelledInvoices: Array<{ id: string; invoiceNumber: string; wasCancelled: boolean }> = [];

  await prisma.$transaction(async (tx) => {
    for (const invoice of existingSalesOrder.invoices) {
      if (invoice.is_cancelled) continue;

      if (invoice.is_printed) {
        await tx.invoices.update({
          where: { id: invoice.id },
          data: {
            is_cancelled: true,
            cancelled_at: now,
            cancellation_reason: 'Pedido eliminado',
            updated_at: now,
          },
        });
        cancelledInvoices.push({
          id: invoice.id.toString(),
          invoiceNumber: invoice.invoice_number,
          wasCancelled: true,
        });

        // Restore stock
        for (const item of existingSalesOrder.sales_order_items) {
          await tx.stock_movements.create({
            data: {
              article_id: item.article_id,
              movement_type: STOCK_MOVEMENT_TYPES.CREDIT,
              quantity: item.quantity,
              reference_document: `Cancelación factura ${invoice.invoice_number} - Pedido eliminado`,
              movement_date: now,
              notes: `Stock devuelto por cancelación de factura al eliminar pedido ${existingSalesOrder.order_number}`,
              created_at: now,
              updated_at: now,
            },
          });
          await tx.articles.update({
            where: { id: item.article_id },
            data: { stock: { increment: item.quantity }, updated_at: now },
          });
        }
      } else {
        await tx.invoices.update({
          where: { id: invoice.id },
          data: { deleted_at: now, updated_at: now },
        });
        cancelledInvoices.push({
          id: invoice.id.toString(),
          invoiceNumber: invoice.invoice_number,
          wasCancelled: false,
        });
      }
    }

    for (const deliveryNote of existingSalesOrder.delivery_notes) {
      affectedDeliveryNoteIds.push(deliveryNote.id.toString());
      await tx.delivery_notes.update({
        where: { id: deliveryNote.id },
        data: { deleted_at: now, updated_at: now },
      });
    }

    await tx.sales_order_items.deleteMany({ where: { sales_order_id: id } });
    await tx.sales_orders.update({
      where: { id },
      data: { deleted_at: now, updated_at: now },
    });
  });

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.ORDER_DELETE,
    description: `Pedido ${existingSalesOrder.order_number} eliminado`,
    entityType: 'sales_order',
    entityId: id,
    details: {
      orderNumber: existingSalesOrder.order_number,
      affectedInvoices: cancelledInvoices.length,
      affectedDeliveryNotes: affectedDeliveryNoteIds.length,
    },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return {
    affectedInvoices: cancelledInvoices,
    affectedDeliveryNotes: affectedDeliveryNoteIds,
    orderNumber: existingSalesOrder.order_number,
  };
}

export async function generateInvoice(
  salesOrderId: bigint,
  usdExchangeRateOverride: number | undefined,
  request: NextRequest
) {
  const salesOrder = await prisma.sales_orders.findUnique({
    where: { id: salesOrderId },
    include: {
      clients: { include: { payment_terms: true } },
      payment_terms: true,
      sales_order_items: {
        include: {
          articles: {
            include: { categories: { include: { category_payment_discounts: true } } },
          },
        },
      },
      invoices: { where: { deleted_at: null }, orderBy: { created_at: 'desc' } },
    },
  });

  if (!salesOrder || salesOrder.deleted_at) {
    return { error: 'Pedido no encontrado', status: 404 };
  }

  if (!salesOrder.sales_order_items || salesOrder.sales_order_items.length === 0) {
    return { error: 'El pedido debe tener al menos un artículo', status: 400 };
  }

  const activeInvoice = salesOrder.invoices.find((inv) => !inv.is_cancelled);
  if (activeInvoice) {
    return { error: 'El pedido ya tiene una factura asociada', status: 400 };
  }

  const paymentTermId = salesOrder.payment_term_id || salesOrder.clients.payment_term_id;
  if (!paymentTermId) {
    return { error: 'El pedido o cliente debe tener una condición de pago asignada', status: 400 };
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const todayInvoicesCount = await prisma.invoices.count({
    where: { invoice_date: { gte: todayStart, lt: todayEnd } },
  });

  const invoiceNumber = `INV-${dateStr}-${String(todayInvoicesCount + 1).padStart(4, '0')}`;

  // Determine exchange rate
  let usdExchangeRate = usdExchangeRateOverride;
  if (!usdExchangeRate) {
    let settings = await prisma.system_settings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await prisma.system_settings.create({
        data: { id: 1, usd_exchange_rate: 1000.0, updated_at: now },
      });
    }
    usdExchangeRate = parseFloat(settings.usd_exchange_rate.toString());
  }

  const TAX_RATE = 0.21;
  let netAmountArs = 0;

  const invoiceItemsData = salesOrder.sales_order_items.map((item) => {
    const unitPriceUsd = parseFloat(item.unit_price.toString());
    const unitPriceArs = unitPriceUsd * usdExchangeRate;

    const categoryPaymentDiscount = item.articles.categories?.category_payment_discounts?.find(
      (cpd) => cpd.payment_term_id === paymentTermId
    );
    const discountPercent = categoryPaymentDiscount
      ? parseFloat(categoryPaymentDiscount.discount_percent.toString())
      : item.articles.categories?.default_discount_percent
        ? parseFloat(item.articles.categories.default_discount_percent.toString())
        : 0;

    const quantity = item.quantity;
    const subtotal = unitPriceArs * quantity;
    const discount = subtotal * (discountPercent / 100);
    const lineTotal = subtotal - discount;
    netAmountArs += lineTotal;

    return {
      sales_order_item_id: item.id,
      article_id: item.article_id,
      article_code: item.articles.code,
      article_description: item.articles.description,
      quantity,
      unit_price_usd: unitPriceUsd,
      unit_price_ars: unitPriceArs,
      discount_percent: discountPercent,
      line_total: lineTotal,
      created_at: now,
    };
  });

  const taxAmount = netAmountArs * TAX_RATE;
  const totalAmount = netAmountArs + taxAmount;

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoices.create({
      data: {
        invoice_number: invoiceNumber,
        sales_order_id: salesOrderId,
        invoice_date: now,
        payment_term_id: paymentTermId,
        net_amount: netAmountArs,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        usd_exchange_rate: usdExchangeRate,
        is_printed: false,
        is_cancelled: false,
        is_credit_note: false,
        is_quotation: false,
        notes: salesOrder.notes,
        created_at: now,
        updated_at: now,
      },
    });

    await tx.invoice_items.createMany({
      data: invoiceItemsData.map((item) => ({ ...item, invoice_id: invoice.id })),
    });

    await tx.sales_orders.update({
      where: { id: salesOrderId },
      data: { status: 'INVOICED', updated_at: now },
    });

    return await tx.invoices.findUnique({
      where: { id: invoice.id },
      include: {
        payment_terms: true,
        invoice_items: true,
        sales_orders: { include: { clients: { include: { tax_conditions: true } } } },
      },
    });
  });

  if (!result) {
    throw new Error('Failed to create invoice');
  }

  const mapped = mapInvoiceToDTO(result);

  const tracker = new ChangeTracker();
  tracker.trackCreate('invoice', result.id, result);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.INVOICE_CREATE,
    description: `Factura ${invoiceNumber} generada desde pedido ${salesOrder.order_number}`,
    entityType: 'invoice',
    entityId: result.id,
    details: {
      invoiceNumber,
      orderNumber: salesOrder.order_number,
      totalAmount: Number(totalAmount),
    },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return { data: mapped, status: 201 };
}

export async function generateDeliveryNote(
  salesOrderId: bigint,
  options: GenerateDeliveryNoteOptions,
  request: NextRequest
) {
  const salesOrder = await prisma.sales_orders.findUnique({
    where: { id: salesOrderId },
    include: {
      clients: true,
      delivery_notes: { where: { deleted_at: null } },
      sales_order_items: { include: { articles: true } },
    },
  });

  if (!salesOrder || salesOrder.deleted_at) {
    return { error: 'Pedido no encontrado', status: 404 };
  }

  if (salesOrder.delivery_notes.length > 0) {
    return { error: 'El pedido ya tiene un remito asociado', status: 400 };
  }

  if (salesOrder.sales_order_items.length === 0) {
    return { error: 'El pedido no tiene items', status: 400 };
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const todayNotesCount = await prisma.delivery_notes.count({
    where: { delivery_date: { gte: todayStart, lt: todayEnd } },
  });

  const deliveryNumber = `REM-${dateStr}-${String(todayNotesCount + 1).padStart(4, '0')}`;
  const clientTransporterId = salesOrder.clients.transporter_id
    ? Number(salesOrder.clients.transporter_id)
    : null;
  const finalTransporterId = options.transporterId
    ? Number(options.transporterId)
    : clientTransporterId;

  const deliveryNote = await prisma.$transaction(async (tx) => {
    const newDeliveryNote = await tx.delivery_notes.create({
      data: {
        delivery_number: deliveryNumber,
        sales_order_id: salesOrderId,
        delivery_date: options.deliveryDate || now,
        transporter_id: finalTransporterId,
        weight_kg: options.weightKg ?? null,
        packages_count: options.packagesCount ?? null,
        declared_value: options.declaredValue ?? null,
        notes: options.notes || salesOrder.notes,
        created_at: now,
        updated_at: now,
      },
    });

    await tx.delivery_note_items.createMany({
      data: salesOrder.sales_order_items.map((item) => ({
        delivery_note_id: newDeliveryNote.id,
        sales_order_item_id: item.id,
        article_id: item.article_id,
        article_code: item.articles.code,
        article_description: item.articles.description,
        quantity: item.quantity,
        created_at: now,
      })),
    });

    return tx.delivery_notes.findUnique({
      where: { id: newDeliveryNote.id },
      include: {
        sales_orders: { include: { clients: true } },
        transporters: true,
        delivery_note_items: true,
      },
    });
  });

  if (!deliveryNote) {
    throw new Error('Failed to create delivery note');
  }

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
    declaredValue: deliveryNote.declared_value
      ? parseFloat(deliveryNote.declared_value.toString())
      : null,
    notes: deliveryNote.notes,
    createdAt: deliveryNote.created_at.toISOString(),
    updatedAt: deliveryNote.updated_at.toISOString(),
    items: deliveryNote.delivery_note_items.map((item) => ({
      id: Number(item.id),
      salesOrderItemId: item.sales_order_item_id ? Number(item.sales_order_item_id) : null,
      articleId: Number(item.article_id),
      articleCode: item.article_code,
      articleDescription: item.article_description,
      quantity: item.quantity,
      createdAt: item.created_at.toISOString(),
    })),
  };

  const tracker = new ChangeTracker();
  tracker.trackCreate('delivery_note', deliveryNote.id, deliveryNote);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.DELIVERY_CREATE,
    description: `Remito ${deliveryNumber} generado desde pedido ${salesOrder.order_number}`,
    entityType: 'delivery_note',
    entityId: deliveryNote.id,
    details: { deliveryNumber, orderNumber: salesOrder.order_number },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return { data: response, status: 201 };
}

export async function getPermissions(id: bigint) {
  const salesOrder = await prisma.sales_orders.findUnique({
    where: { id },
    include: {
      invoices: {
        select: { id: true, invoice_number: true, is_printed: true, is_cancelled: true },
        where: { deleted_at: null },
        orderBy: { created_at: 'desc' },
        take: 1,
      },
      delivery_notes: {
        select: { id: true },
        where: { deleted_at: null },
        take: 1,
      },
    },
  });

  if (!salesOrder || salesOrder.deleted_at) {
    return null;
  }

  const invoice = salesOrder.invoices[0];
  const deliveryNote = salesOrder.delivery_notes[0];

  const status: SalesOrderStatus = {
    id: Number(salesOrder.id),
    hasInvoice: !!invoice,
    invoicePrinted: invoice?.is_printed ?? false,
    invoiceCancelled: invoice?.is_cancelled ?? false,
    hasDeliveryNote: !!deliveryNote,
    hasUnsavedChanges: false,
  };

  const permissions = calculatePermissions(status);

  return { status, permissions };
}
