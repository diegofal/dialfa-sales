import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { STOCK_MOVEMENT_TYPES } from '@/lib/constants/stockMovementTypes';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    // Check if invoice exists and is not deleted
    const existingInvoice = await prisma.invoices.findUnique({
      where: { id },
    });

    if (!existingInvoice || existingInvoice.deleted_at) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if invoice is already cancelled
    if (existingInvoice.is_cancelled) {
      return NextResponse.json(
        { error: 'Invoice is already cancelled' },
        { status: 400 }
      );
    }

    // Track before state
    const tracker = new ChangeTracker();
    await tracker.trackBefore('invoice', id);

    const now = new Date();
    const isCancellingPrintedInvoice = existingInvoice.is_printed;

    // Update invoice and restore stock if needed in transaction
    await prisma.$transaction(async (tx) => {
      // If cancelling a printed invoice, restore stock
      if (isCancellingPrintedInvoice) {
        // Get sales order items to restore stock
        const salesOrder = await tx.sales_orders.findUnique({
          where: { id: existingInvoice.sales_order_id },
          include: {
            sales_order_items: true,
          },
        });

        if (salesOrder) {
          for (const item of salesOrder.sales_order_items) {
            // Create positive stock movement (credit - return to stock)
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

            // Update article stock
            await tx.articles.update({
              where: { id: item.article_id },
              data: {
                stock: {
                  increment: item.quantity,
                },
                updated_at: now,
              },
            });
          }
        }
      }

      // Update the invoice
      await tx.invoices.update({
        where: { id },
        data: {
          is_cancelled: true,
          cancelled_at: now,
          cancellation_reason: 'Cancelado por usuario',
          updated_at: now,
        },
      });

      // Check if we need to update sales order status
      const salesOrder = await tx.sales_orders.findUnique({
        where: { id: existingInvoice.sales_order_id },
        include: {
          invoices: {
            where: {
              deleted_at: null,
              is_cancelled: false,
            },
          },
        },
      });

      // If no active invoices remain (excluding the one we just cancelled), set order status back to PENDING
      if (salesOrder && salesOrder.invoices.length === 0) {
        await tx.sales_orders.update({
          where: { id: existingInvoice.sales_order_id },
          data: {
            status: 'PENDING',
            updated_at: now,
          },
        });
      }
    });

    // Track after state
    await tracker.trackAfter('invoice', id);

    // Log activity
    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.INVOICE_CANCEL,
      description: `Factura ${existingInvoice.invoice_number} anulada`,
      entityType: 'invoice',
      entityId: id,
      details: { invoiceNumber: existingInvoice.invoice_number }
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

    return NextResponse.json(
      { message: 'Invoice cancelled successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    return NextResponse.json(
      { error: 'Failed to cancel invoice' },
      { status: 500 }
    );
  }
}




