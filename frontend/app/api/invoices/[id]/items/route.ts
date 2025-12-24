import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapInvoiceToDTO } from '@/lib/utils/mapper';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

const updateInvoiceItemsSchema = z.object({
  items: z.array(z.object({
    id: z.number(),
    discountPercent: z.number().min(0).max(100),
  })),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const invoiceId = BigInt(idStr);
    const body = await request.json();

    const validatedData = updateInvoiceItemsSchema.parse(body);

    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: { 
        invoice_items: true,
        sales_orders: {
          include: {
            clients: true,
          },
        },
      },
    });

    if (!invoice || invoice.deleted_at) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.is_printed) {
      return NextResponse.json({ error: 'Cannot edit printed invoices' }, { status: 400 });
    }

    if (invoice.is_cancelled) {
      return NextResponse.json({ error: 'Cannot edit cancelled invoices' }, { status: 400 });
    }

    const tracker = new ChangeTracker();
    await tracker.trackBefore('invoice', invoiceId);

    const usdExchangeRate = parseFloat(String(invoice.usd_exchange_rate || 1000));
    const TAX_RATE = 0.21;
    const now = new Date();

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      let netAmountArs = 0;

      for (const itemUpdate of validatedData.items) {
        const item = invoice.invoice_items.find(i => i.id === BigInt(itemUpdate.id));
        if (!item) continue;

        const unitPriceUsd = parseFloat(String(item.unit_price_usd));
        const unitPriceArs = unitPriceUsd * usdExchangeRate;
        const quantity = item.quantity;
        const discountPercent = itemUpdate.discountPercent;

        const subtotal = unitPriceArs * quantity;
        const discount = subtotal * (discountPercent / 100);
        const lineTotal = subtotal - discount;

        netAmountArs += lineTotal;

        await tx.invoice_items.update({
          where: { id: item.id },
          data: {
            discount_percent: discountPercent,
            line_total: lineTotal,
          },
        });
      }

      const taxAmount = netAmountArs * TAX_RATE;
      const totalAmount = netAmountArs + taxAmount;

      return await tx.invoices.update({
        where: { id: invoiceId },
        data: {
          net_amount: netAmountArs,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          updated_at: now,
        },
        include: {
          invoice_items: true,
          sales_orders: {
            include: {
              clients: {
                include: { tax_conditions: true },
              },
            },
          },
        },
      });
    });

    await tracker.trackAfter('invoice', invoiceId);

    const mappedInvoice = mapInvoiceToDTO(updatedInvoice);

    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.INVOICE_UPDATE,
      description: `Descuentos actualizados en factura ${invoice.invoice_number}`,
      entityType: 'invoice',
      entityId: invoiceId,
      details: {
        invoiceNumber: invoice.invoice_number,
        itemsUpdated: validatedData.items.length,
        newTotal: Number(updatedInvoice.total_amount),
      },
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

    return NextResponse.json(mappedInvoice);
  } catch (error) {
    console.error('Error updating invoice items:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update invoice items' },
      { status: 500 }
    );
  }
}

