import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { STOCK_MOVEMENT_TYPES } from '@/lib/constants/stockMovementTypes';
import { prisma } from '@/lib/db';
import { loadTemplate } from '@/lib/print-templates/template-loader';
import { logActivity } from '@/lib/utils/activityLogger';
import { ChangeTracker } from '@/lib/utils/changeTracker';
import { mapInvoiceToDTO } from '@/lib/utils/mapper';
import { pdfService } from '@/lib/utils/pdfGenerator';
import { CreateInvoiceInput, UpdateInvoiceInput } from '@/lib/validations/schemas';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceListParams {
  page: number;
  limit: number;
  search?: string;
  isCancelled?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

function getMovementTypeName(type: number): string {
  const typeNames: Record<number, string> = {
    1: 'Compra',
    2: 'Venta',
    3: 'Devolución',
    4: 'Ajuste',
    5: 'Transferencia',
  };
  return typeNames[type] || 'Otro';
}

export async function list(params: InvoiceListParams) {
  const { page, limit, search, isCancelled } = params;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { deleted_at: null };

  if (search) {
    where.OR = [{ invoice_number: { contains: search, mode: 'insensitive' } }];
  }
  if (isCancelled !== undefined && isCancelled !== null) {
    where.is_cancelled = isCancelled === 'true';
  }

  const [invoices, total] = await Promise.all([
    prisma.invoices.findMany({
      where,
      include: {
        invoice_items: true,
        sales_orders: { include: { clients: true } },
        payment_terms: true,
      },
      orderBy: { invoice_date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.invoices.count({ where }),
  ]);

  return {
    data: invoices.map(mapInvoiceToDTO),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getById(id: bigint) {
  const invoice = await prisma.invoices.findUnique({
    where: { id },
    include: {
      payment_terms: true,
      invoice_items: { include: { articles: true } },
      sales_orders: {
        include: {
          clients: { include: { tax_conditions: true } },
          sales_order_items: {
            include: {
              articles: {
                include: {
                  stock_movements: {
                    where: { reference_document: { contains: id.toString() } },
                    orderBy: { created_at: 'desc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!invoice || invoice.deleted_at) {
    return null;
  }

  return mapInvoiceToDTO(invoice);
}

export async function create(data: CreateInvoiceInput, request: NextRequest) {
  const salesOrder = await prisma.sales_orders.findUnique({
    where: { id: data.salesOrderId },
    include: {
      sales_order_items: {
        include: {
          articles: { include: { categories: { include: { category_payment_discounts: true } } } },
        },
      },
      invoices: { where: { deleted_at: null, is_cancelled: false } },
    },
  });

  if (!salesOrder || salesOrder.deleted_at) {
    return { error: 'Sales order not found', status: 404 };
  }

  if (!data.isCreditNote && !data.isQuotation && salesOrder.invoices.length > 0) {
    return { error: 'Sales order already has an invoice', status: 400 };
  }

  let usdExchangeRate = data.usdExchangeRate;
  if (!usdExchangeRate) {
    let settings = await prisma.system_settings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await prisma.system_settings.create({
        data: { id: 1, usd_exchange_rate: 1000.0, updated_at: new Date() },
      });
    }
    usdExchangeRate = parseFloat(settings.usd_exchange_rate.toString());
  }

  const paymentTermId = data.paymentTermId ?? salesOrder.payment_term_id ?? null;

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const todayCount = await prisma.invoices.count({
    where: { invoice_date: { gte: todayStart, lt: todayEnd } },
  });
  const invoiceNumber = `INV-${dateStr}-${String(todayCount + 1).padStart(4, '0')}`;

  const TAX_RATE = 0.21;
  let netAmountArs = 0;

  const invoiceItemsData = salesOrder.sales_order_items.map((item) => {
    const unitPriceUsd = parseFloat(item.unit_price.toString());
    const unitPriceArs = unitPriceUsd * usdExchangeRate;
    let discountPercent = 0;
    if (paymentTermId && item.articles.categories) {
      const catDiscount = item.articles.categories.category_payment_discounts.find(
        (d) => d.payment_term_id === paymentTermId
      );
      discountPercent = catDiscount ? parseFloat(catDiscount.discount_percent.toString()) : 0;
    }
    const quantity = item.quantity;
    const subtotal = unitPriceArs * quantity;
    const lineTotal = subtotal - subtotal * (discountPercent / 100);
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
        sales_order_id: data.salesOrderId,
        invoice_date: data.invoiceDate || now,
        payment_term_id: paymentTermId,
        net_amount: netAmountArs,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        usd_exchange_rate: usdExchangeRate,
        is_credit_note: data.isCreditNote ?? false,
        is_quotation: data.isQuotation ?? false,
        notes: data.notes,
        created_at: now,
        updated_at: now,
      },
    });

    await tx.invoice_items.createMany({
      data: invoiceItemsData.map((item) => ({ ...item, invoice_id: invoice.id })),
    });

    if (!data.isQuotation) {
      await tx.sales_orders.update({
        where: { id: data.salesOrderId },
        data: { status: 'INVOICED', updated_at: now },
      });
    }

    return await tx.invoices.findUnique({
      where: { id: invoice.id },
      include: {
        invoice_items: true,
        sales_orders: { include: { clients: true } },
        payment_terms: true,
      },
    });
  });

  if (!result) {
    throw new Error('Failed to create invoice');
  }

  await logActivity({
    request,
    operation: OPERATIONS.INVOICE_CREATE,
    description: `Factura ${result.invoice_number} creada para pedido ${result.sales_orders.order_number}`,
    entityType: 'invoice',
    entityId: result.id,
    details: {
      totalAmount: Number(result.total_amount),
      orderNumber: result.sales_orders.order_number,
    },
  });

  return { data: mapInvoiceToDTO(result), status: 201 };
}

export async function update(
  id: bigint,
  data: UpdateInvoiceInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawBody: Record<string, any>,
  request: NextRequest
) {
  const existingInvoice = await prisma.invoices.findUnique({ where: { id } });

  if (!existingInvoice || existingInvoice.deleted_at) {
    return { error: 'Invoice not found', status: 404 };
  }
  if (existingInvoice.is_cancelled) {
    return { error: 'Cannot edit cancelled invoices', status: 400 };
  }

  const tracker = new ChangeTracker();
  await tracker.trackBefore('invoice', id);

  const now = new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = { updated_at: now };

  if (data.salesOrderId !== undefined) updateData.sales_order_id = data.salesOrderId;
  if (data.invoiceDate !== undefined) updateData.invoice_date = data.invoiceDate;
  if (data.usdExchangeRate !== undefined) updateData.usd_exchange_rate = data.usdExchangeRate;
  if (data.isCreditNote !== undefined) updateData.is_credit_note = data.isCreditNote;
  if (data.isQuotation !== undefined) updateData.is_quotation = data.isQuotation;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const isCancellingPrinted =
    (rawBody.is_cancelled === true || rawBody.isCancelled === true) &&
    !existingInvoice.is_cancelled &&
    existingInvoice.is_printed;

  if (rawBody.is_cancelled === true || rawBody.isCancelled === true) {
    updateData.is_cancelled = true;
    updateData.cancelled_at = now;
    if (rawBody.cancellation_reason || rawBody.cancellationReason) {
      updateData.cancellation_reason = rawBody.cancellation_reason || rawBody.cancellationReason;
    }
  }

  const isPrintingNow =
    (rawBody.is_printed === true || rawBody.isPrinted === true) && !existingInvoice.is_printed;
  if (rawBody.is_printed === true || rawBody.isPrinted === true) {
    updateData.is_printed = true;
    if (!existingInvoice.printed_at) updateData.printed_at = now;
  }

  const invoice = await prisma.$transaction(async (tx) => {
    if (isCancellingPrinted) {
      const salesOrder = await tx.sales_orders.findUnique({
        where: { id: existingInvoice.sales_order_id },
        include: { sales_order_items: true },
      });
      if (salesOrder) {
        for (const item of salesOrder.sales_order_items) {
          await tx.stock_movements.create({
            data: {
              article_id: item.article_id,
              movement_type: STOCK_MOVEMENT_TYPES.CREDIT,
              quantity: item.quantity,
              reference_document: `Cancelación factura ${existingInvoice.invoice_number}`,
              movement_date: now,
              notes: `Stock devuelto por cancelación de factura impresa: ${rawBody.cancellation_reason || rawBody.cancellationReason || 'Sin razón especificada'}`,
              created_at: now,
              updated_at: now,
            },
          });
          await tx.articles.update({
            where: { id: item.article_id },
            data: { stock: { increment: item.quantity }, updated_at: now },
          });
        }
      }
    }

    if (isPrintingNow) {
      const salesOrder = await tx.sales_orders.findUnique({
        where: { id: existingInvoice.sales_order_id },
        include: { sales_order_items: true },
      });
      if (salesOrder) {
        for (const item of salesOrder.sales_order_items) {
          await tx.stock_movements.create({
            data: {
              article_id: item.article_id,
              movement_type: STOCK_MOVEMENT_TYPES.DEBIT,
              quantity: item.quantity,
              reference_document: `Impresión factura ${existingInvoice.invoice_number}`,
              movement_date: now,
              notes: `Stock debitado por impresión de factura`,
              created_at: now,
              updated_at: now,
            },
          });
          await tx.articles.update({
            where: { id: item.article_id },
            data: { stock: { decrement: item.quantity }, updated_at: now },
          });
        }
      }
    }

    const updatedInvoice = await tx.invoices.update({
      where: { id },
      data: updateData,
      include: { sales_orders: { include: { clients: true, sales_order_items: true } } },
    });

    if (updateData.is_cancelled) {
      const so = await tx.sales_orders.findUnique({
        where: { id: existingInvoice.sales_order_id },
        include: { invoices: { where: { deleted_at: null, is_cancelled: false } } },
      });
      if (so && so.invoices.length === 0) {
        await tx.sales_orders.update({
          where: { id: existingInvoice.sales_order_id },
          data: { status: 'PENDING', updated_at: now },
        });
      }
    }

    return updatedInvoice;
  });

  await tracker.trackAfter('invoice', id);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.INVOICE_UPDATE,
    description: `Factura ${existingInvoice.invoice_number} actualizada`,
    entityType: 'invoice',
    entityId: id,
    details: {
      invoiceNumber: existingInvoice.invoice_number,
      wasCancelled: updateData.is_cancelled,
      wasPrinted: isPrintingNow,
    },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return { data: invoice, status: 200 };
}

export async function remove(id: bigint, request: NextRequest) {
  const existingInvoice = await prisma.invoices.findUnique({ where: { id } });

  if (!existingInvoice || existingInvoice.deleted_at) {
    return { error: 'Invoice not found', status: 404 };
  }
  if (existingInvoice.is_printed) {
    return { error: 'Cannot delete printed invoices', status: 400 };
  }
  if (existingInvoice.is_cancelled) {
    return { error: 'Cannot delete cancelled invoices', status: 400 };
  }

  const tracker = new ChangeTracker();
  tracker.trackDelete('invoice', id, existingInvoice);

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.invoices.update({ where: { id }, data: { deleted_at: now, updated_at: now } });

    const so = await tx.sales_orders.findUnique({
      where: { id: existingInvoice.sales_order_id },
      include: { invoices: { where: { deleted_at: null, is_cancelled: false } } },
    });
    if (so && so.invoices.length === 0) {
      await tx.sales_orders.update({
        where: { id: existingInvoice.sales_order_id },
        data: { status: 'PENDING', updated_at: now },
      });
    }
  });

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.INVOICE_DELETE,
    description: `Factura ${existingInvoice.invoice_number} eliminada`,
    entityType: 'invoice',
    entityId: id,
    details: { invoiceNumber: existingInvoice.invoice_number },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return { status: 200 };
}

export async function cancel(id: bigint, request: NextRequest) {
  const existingInvoice = await prisma.invoices.findUnique({ where: { id } });

  if (!existingInvoice || existingInvoice.deleted_at) {
    return { error: 'Invoice not found', status: 404 };
  }
  if (existingInvoice.is_cancelled) {
    return { error: 'Invoice is already cancelled', status: 400 };
  }

  const tracker = new ChangeTracker();
  await tracker.trackBefore('invoice', id);

  const now = new Date();
  const isCancellingPrinted = existingInvoice.is_printed;

  await prisma.$transaction(async (tx) => {
    if (isCancellingPrinted) {
      const salesOrder = await tx.sales_orders.findUnique({
        where: { id: existingInvoice.sales_order_id },
        include: { sales_order_items: true },
      });
      if (salesOrder) {
        for (const item of salesOrder.sales_order_items) {
          await tx.stock_movements.create({
            data: {
              article_id: item.article_id,
              movement_type: STOCK_MOVEMENT_TYPES.CREDIT,
              quantity: item.quantity,
              reference_document: `Cancelación factura ${existingInvoice.invoice_number}`,
              movement_date: now,
              notes: 'Stock devuelto por cancelación de factura impresa',
              created_at: now,
              updated_at: now,
            },
          });
          await tx.articles.update({
            where: { id: item.article_id },
            data: { stock: { increment: item.quantity }, updated_at: now },
          });
        }
      }
    }

    await tx.invoices.update({
      where: { id },
      data: {
        is_cancelled: true,
        cancelled_at: now,
        cancellation_reason: 'Cancelado por usuario',
        updated_at: now,
      },
    });

    const so = await tx.sales_orders.findUnique({
      where: { id: existingInvoice.sales_order_id },
      include: { invoices: { where: { deleted_at: null, is_cancelled: false } } },
    });
    if (so && so.invoices.length === 0) {
      await tx.sales_orders.update({
        where: { id: existingInvoice.sales_order_id },
        data: { status: 'PENDING', updated_at: now },
      });
    }
  });

  await tracker.trackAfter('invoice', id);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.INVOICE_CANCEL,
    description: `Factura ${existingInvoice.invoice_number} anulada`,
    entityType: 'invoice',
    entityId: id,
    details: { invoiceNumber: existingInvoice.invoice_number },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return { status: 200 };
}

export async function updateExchangeRate(
  id: bigint,
  newExchangeRate: number,
  request: NextRequest
) {
  const existingInvoice = await prisma.invoices.findUnique({
    where: { id },
    include: { invoice_items: true },
  });

  if (!existingInvoice || existingInvoice.deleted_at) {
    return { error: 'Invoice not found', status: 404 };
  }
  if (existingInvoice.is_printed) {
    return { error: 'Cannot edit printed invoices', status: 400 };
  }
  if (existingInvoice.is_cancelled) {
    return { error: 'Cannot edit cancelled invoices', status: 400 };
  }

  const now = new Date();
  const TAX_RATE = 0.21;

  const result = await prisma.$transaction(async (tx) => {
    let totalNetAmount = 0;

    for (const item of existingInvoice.invoice_items) {
      const unitPriceUsd = parseFloat(item.unit_price_usd.toString());
      const unitPriceArs = unitPriceUsd * newExchangeRate;
      const discountPercent = parseFloat(item.discount_percent.toString());
      const subtotal = unitPriceArs * item.quantity;
      const lineTotal = subtotal - subtotal * (discountPercent / 100);
      totalNetAmount += lineTotal;

      await tx.invoice_items.update({
        where: { id: item.id },
        data: { unit_price_ars: unitPriceArs, line_total: lineTotal },
      });
    }

    const taxAmount = totalNetAmount * TAX_RATE;
    const totalAmount = totalNetAmount + taxAmount;

    return await tx.invoices.update({
      where: { id },
      data: {
        usd_exchange_rate: newExchangeRate,
        net_amount: totalNetAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        updated_at: now,
      },
      include: {
        invoice_items: true,
        sales_orders: { include: { clients: { include: { tax_conditions: true } } } },
      },
    });
  });

  const previousRate = existingInvoice.usd_exchange_rate
    ? parseFloat(existingInvoice.usd_exchange_rate.toString())
    : null;

  await logActivity({
    request,
    operation: OPERATIONS.INVOICE_EXCHANGE_RATE_UPDATE,
    description: `Tipo de cambio de factura ${result.invoice_number} actualizado de ${previousRate || 'N/A'} a ${newExchangeRate}`,
    entityType: 'invoice',
    entityId: result.id,
    details: {
      invoiceNumber: result.invoice_number,
      previousRate,
      newRate: newExchangeRate,
      newTotalAmount: parseFloat(result.total_amount.toString()),
    },
  });

  return {
    data: {
      id: result.id.toString(),
      invoiceNumber: result.invoice_number,
      usdExchangeRate: result.usd_exchange_rate
        ? parseFloat(result.usd_exchange_rate.toString())
        : null,
      netAmount: parseFloat(result.net_amount.toString()),
      taxAmount: parseFloat(result.tax_amount.toString()),
      totalAmount: parseFloat(result.total_amount.toString()),
      items: result.invoice_items.map((item) => ({
        id: item.id.toString(),
        articleCode: item.article_code,
        articleDescription: item.article_description,
        quantity: item.quantity,
        unitPriceUsd: parseFloat(item.unit_price_usd.toString()),
        unitPriceArs: parseFloat(item.unit_price_ars.toString()),
        discountPercent: parseFloat(item.discount_percent.toString()),
        lineTotal: parseFloat(item.line_total.toString()),
      })),
    },
    status: 200,
  };
}

export async function updateItems(
  id: bigint,
  items: Array<{ id: number; discountPercent: number }>,
  request: NextRequest
) {
  const invoice = await prisma.invoices.findUnique({
    where: { id },
    include: { invoice_items: true, sales_orders: { include: { clients: true } } },
  });

  if (!invoice || invoice.deleted_at) {
    return { error: 'Invoice not found', status: 404 };
  }
  if (invoice.is_printed) {
    return { error: 'Cannot edit printed invoices', status: 400 };
  }
  if (invoice.is_cancelled) {
    return { error: 'Cannot edit cancelled invoices', status: 400 };
  }

  const tracker = new ChangeTracker();
  await tracker.trackBefore('invoice', id);

  const usdExchangeRate = parseFloat(String(invoice.usd_exchange_rate || 1000));
  const TAX_RATE = 0.21;
  const now = new Date();

  const updatedInvoice = await prisma.$transaction(async (tx) => {
    let netAmountArs = 0;

    for (const itemUpdate of items) {
      const item = invoice.invoice_items.find((i) => i.id === BigInt(itemUpdate.id));
      if (!item) continue;

      const unitPriceUsd = parseFloat(String(item.unit_price_usd));
      const unitPriceArs = unitPriceUsd * usdExchangeRate;
      const subtotal = unitPriceArs * item.quantity;
      const lineTotal = subtotal - subtotal * (itemUpdate.discountPercent / 100);
      netAmountArs += lineTotal;

      await tx.invoice_items.update({
        where: { id: item.id },
        data: { discount_percent: itemUpdate.discountPercent, line_total: lineTotal },
      });
    }

    const taxAmount = netAmountArs * TAX_RATE;
    const totalAmount = netAmountArs + taxAmount;

    return await tx.invoices.update({
      where: { id },
      data: {
        net_amount: netAmountArs,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        updated_at: now,
      },
      include: {
        invoice_items: true,
        sales_orders: { include: { clients: { include: { tax_conditions: true } } } },
      },
    });
  });

  await tracker.trackAfter('invoice', id);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.INVOICE_UPDATE,
    description: `Descuentos actualizados en factura ${invoice.invoice_number}`,
    entityType: 'invoice',
    entityId: id,
    details: {
      invoiceNumber: invoice.invoice_number,
      itemsUpdated: items.length,
      newTotal: Number(updatedInvoice.total_amount),
    },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return { data: mapInvoiceToDTO(updatedInvoice), status: 200 };
}

export async function updatePaymentTerm(id: bigint, paymentTermId: number, request: NextRequest) {
  const existingInvoice = await prisma.invoices.findUnique({
    where: { id },
    include: {
      sales_orders: { include: { clients: true } },
      payment_terms: true,
      invoice_items: {
        include: {
          articles: { include: { categories: { include: { category_payment_discounts: true } } } },
        },
      },
    },
  });

  if (!existingInvoice || existingInvoice.deleted_at) {
    return { error: 'Invoice not found', status: 404 };
  }
  if (existingInvoice.is_printed) {
    return { error: 'No se puede modificar una factura impresa', status: 403 };
  }
  if (existingInvoice.is_cancelled) {
    return { error: 'No se puede modificar una factura cancelada', status: 403 };
  }

  const now = new Date();
  const usdExchangeRate = parseFloat(existingInvoice.usd_exchange_rate?.toString() || '1000');
  const TAX_RATE = 0.21;

  let netAmountArs = 0;
  const updatedItemsData = existingInvoice.invoice_items.map((item) => {
    const unitPriceUsd = parseFloat(item.unit_price_usd.toString());
    const unitPriceArs = unitPriceUsd * usdExchangeRate;
    const catDiscount = item.articles.categories?.category_payment_discounts?.find(
      (cpd) => cpd.payment_term_id === paymentTermId
    );
    const discountPercent = catDiscount
      ? parseFloat(catDiscount.discount_percent.toString())
      : item.articles.categories?.default_discount_percent
        ? parseFloat(item.articles.categories.default_discount_percent.toString())
        : 0;
    const subtotal = unitPriceArs * item.quantity;
    const lineTotal = subtotal - subtotal * (discountPercent / 100);
    netAmountArs += lineTotal;
    return { id: item.id, discountPercent, lineTotal };
  });

  const taxAmount = netAmountArs * TAX_RATE;
  const totalAmount = netAmountArs + taxAmount;

  await prisma.$transaction(async (tx) => {
    for (const itemData of updatedItemsData) {
      await tx.invoice_items.update({
        where: { id: itemData.id },
        data: { discount_percent: itemData.discountPercent, line_total: itemData.lineTotal },
      });
    }
    await tx.invoices.update({
      where: { id },
      data: {
        payment_term_id: paymentTermId,
        net_amount: netAmountArs,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        updated_at: now,
      },
    });
    await tx.clients.update({
      where: { id: existingInvoice.sales_orders.client_id },
      data: { payment_term_id: paymentTermId, updated_at: now },
    });
  });

  const updatedInvoice = await prisma.invoices.findUnique({
    where: { id },
    include: { payment_terms: true },
  });

  await logActivity({
    request,
    operation: OPERATIONS.INVOICE_UPDATE,
    description: `Condición de pago actualizada en factura ${existingInvoice.invoice_number} - descuentos recalculados`,
    entityType: 'invoice',
    entityId: id,
    details: {
      oldPaymentTermId: existingInvoice.payment_term_id,
      newPaymentTermId: paymentTermId,
      oldTotal: Number(existingInvoice.total_amount),
      newTotal: Number(totalAmount),
    },
  });

  return {
    data: {
      paymentTermId: updatedInvoice?.payment_term_id,
      paymentTermName: updatedInvoice?.payment_terms?.name,
      itemsRecalculated: updatedItemsData.length,
      newTotal: totalAmount,
    },
    status: 200,
  };
}

export async function getStockMovements(invoiceId: bigint) {
  const invoice = await prisma.invoices.findUnique({
    where: { id: invoiceId },
    include: { invoice_items: { select: { article_id: true } } },
  });

  if (!invoice || invoice.deleted_at) {
    return null;
  }

  const articleIds = invoice.invoice_items.map((item) => item.article_id);

  const stockMovements = await prisma.stock_movements.findMany({
    where: {
      AND: [
        { deleted_at: null },
        {
          OR: [
            { reference_document: { contains: invoice.invoice_number } },
            {
              article_id: { in: articleIds },
              reference_document: { contains: invoice.invoice_number },
            },
          ],
        },
      ],
    },
    include: { articles: { select: { code: true, description: true } } },
    orderBy: { movement_date: 'desc' },
  });

  return stockMovements.map((movement) => ({
    id: Number(movement.id),
    articleId: Number(movement.article_id),
    articleCode: movement.articles.code,
    articleDescription: movement.articles.description,
    movementType: movement.movement_type,
    movementTypeName: getMovementTypeName(movement.movement_type),
    quantity: movement.quantity,
    referenceDocument: movement.reference_document,
    movementDate: movement.movement_date.toISOString(),
    notes: movement.notes,
    createdAt: movement.created_at.toISOString(),
  }));
}

export async function getPDF(id: bigint) {
  const invoice = await prisma.invoices.findUnique({
    where: { id },
    include: {
      invoice_items: true,
      sales_orders: {
        include: {
          clients: { include: { tax_conditions: true, provinces: true } },
        },
      },
    },
  });

  if (!invoice || invoice.deleted_at) {
    return null;
  }

  const template = await loadTemplate('invoice', 'default');
  const pdfBuffer = await pdfService.generateInvoicePDF(invoice, template);

  return { pdfBuffer, invoiceNumber: invoice.invoice_number };
}

export async function print(id: bigint, request: NextRequest) {
  const invoice = await prisma.invoices.findUnique({
    where: { id },
    include: {
      invoice_items: true,
      sales_orders: {
        include: {
          clients: { include: { tax_conditions: true, provinces: true } },
          sales_order_items: true,
        },
      },
    },
  });

  if (!invoice || invoice.deleted_at) {
    return { error: 'Invoice not found', status: 404 };
  }
  if (invoice.is_cancelled) {
    return { error: 'Cannot print cancelled invoice', status: 400 };
  }

  const now = new Date();
  const wasAlreadyPrinted = invoice.is_printed;

  if (!wasAlreadyPrinted) {
    await prisma.$transaction(async (tx) => {
      await tx.invoices.update({
        where: { id },
        data: { is_printed: true, printed_at: now, updated_at: now },
      });

      if (invoice.sales_orders) {
        for (const item of invoice.sales_orders.sales_order_items) {
          await tx.stock_movements.create({
            data: {
              article_id: item.article_id,
              movement_type: STOCK_MOVEMENT_TYPES.DEBIT,
              quantity: item.quantity,
              reference_document: `Impresión factura ${invoice.invoice_number}`,
              movement_date: now,
              notes: 'Stock debitado por impresión de factura',
              created_at: now,
              updated_at: now,
            },
          });
          await tx.articles.update({
            where: { id: item.article_id },
            data: { stock: { decrement: item.quantity }, updated_at: now },
          });
        }
      }
    });

    await logActivity({
      request,
      operation: OPERATIONS.INVOICE_PRINT,
      description: `Factura ${invoice.invoice_number} impresa`,
      entityType: 'invoice',
      entityId: id,
      details: { invoiceNumber: invoice.invoice_number },
    });
  }

  const template = await loadTemplate('invoice', 'default');
  const pdfBuffer = await pdfService.generateInvoicePDF(invoice, template);

  return { data: { pdfBuffer, invoiceNumber: invoice.invoice_number }, status: 200 };
}
