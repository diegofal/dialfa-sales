import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapInvoiceToDTO } from '@/lib/utils/mapper';

/**
 * Generate an invoice from a sales order
 * Based on BUTTON_STATUSES.md lines 415-427
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const salesOrderId = BigInt(idStr);

    // Fetch the sales order with all necessary data
    const salesOrder = await prisma.sales_orders.findUnique({
      where: { id: salesOrderId },
      include: {
        clients: true,
        sales_order_items: {
          include: {
            articles: true,
          },
        },
        invoices: {
          where: {
            deleted_at: null,
          },
          orderBy: {
            created_at: 'desc',
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

    // Check if sales order has items
    if (!salesOrder.sales_order_items || salesOrder.sales_order_items.length === 0) {
      return NextResponse.json(
        { error: 'El pedido debe tener al menos un artículo' },
        { status: 400 }
      );
    }

    // Check if already has an active (non-cancelled) invoice
    const activeInvoice = salesOrder.invoices.find(inv => !inv.is_cancelled);
    if (activeInvoice) {
      return NextResponse.json(
        { error: 'El pedido ya tiene una factura asociada' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Generate invoice number (format: INV-YYYYMMDD-XXXX)
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of invoices today to generate sequence
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const todayInvoicesCount = await prisma.invoices.count({
      where: {
        invoice_date: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });
    
    const sequence = String(todayInvoicesCount + 1).padStart(4, '0');
    const invoiceNumber = `INV-${dateStr}-${sequence}`;

    // Get USD exchange rate from request body or use current value
    const body = await request.json().catch(() => ({}));
    const usdExchangeRate = body.usdExchangeRate ?? null;

    // Calculate amounts
    // Apply special discount to the total
    const subtotal = parseFloat(salesOrder.total.toString());
    const discountAmount = subtotal * (parseFloat(salesOrder.special_discount_percent.toString()) / 100);
    const netAmount = subtotal - discountAmount;
    
    // Assuming 21% tax rate (IVA) - this should be configurable based on client's tax condition
    const TAX_RATE = 0.21;
    const taxAmount = netAmount * TAX_RATE;
    const totalAmount = netAmount + taxAmount;

    // Create invoice in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the invoice
      const invoice = await tx.invoices.create({
        data: {
          invoice_number: invoiceNumber,
          sales_order_id: salesOrderId,
          invoice_date: now,
          net_amount: netAmount,
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

      // Update sales order status to INVOICED
      await tx.sales_orders.update({
        where: { id: salesOrderId },
        data: {
          status: 'INVOICED',
          updated_at: now,
        },
      });

      // Return the full invoice with relations
      return await tx.invoices.findUnique({
        where: { id: invoice.id },
        include: {
          sales_orders: {
            include: {
              clients: true,
              sales_order_items: {
                include: {
                  articles: true,
                },
              },
            },
          },
        },
      });
    });

    if (!result) {
      throw new Error('Failed to create invoice');
    }

    // Map to DTO format
    const mappedInvoice = mapInvoiceToDTO(result);

    return NextResponse.json(mappedInvoice, { status: 201 });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Error al generar la factura' },
      { status: 500 }
    );
  }
}


