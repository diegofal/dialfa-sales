import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapInvoiceToDTO } from '@/lib/utils/mapper';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

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
            articles: {
              include: {
                categories: true, // Incluir categorías para obtener default_discount_percent
              }
            },
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

    // Get USD exchange rate from request body or use system settings
    const body = await request.json().catch(() => ({}));
    let usdExchangeRate = body.usdExchangeRate;
    if (!usdExchangeRate) {
      let settings = await prisma.system_settings.findUnique({
        where: { id: 1 },
      });
      
      // If settings don't exist, create with default values
      if (!settings) {
        settings = await prisma.system_settings.create({
          data: {
            id: 1,
            usd_exchange_rate: 1000.00,
            updated_at: now,
          },
        });
      }
      
      usdExchangeRate = parseFloat(settings.usd_exchange_rate.toString());
    }

    // Calculate amounts with USD to ARS conversion
    const TAX_RATE = 0.21; // 21% IVA
    
    let netAmountArs = 0;
    
    // Prepare invoice items with conversion
    const invoiceItemsData = salesOrder.sales_order_items.map((item) => {
      const unitPriceUsd = parseFloat(item.unit_price.toString());
      const unitPriceArs = unitPriceUsd * usdExchangeRate;
      // Obtener descuento de la categoría del artículo
      const discountPercent = item.articles.categories?.default_discount_percent 
        ? parseFloat(item.articles.categories.default_discount_percent.toString())
        : 0;
      const quantity = item.quantity;
      
      // Calculate line total: (price * quantity) - discount
      const subtotal = unitPriceArs * quantity;
      const discount = subtotal * (discountPercent / 100);
      const lineTotal = subtotal - discount;
      
      netAmountArs += lineTotal;
      
      return {
        sales_order_item_id: item.id,
        article_id: item.article_id,
        article_code: item.articles.code,
        article_description: item.articles.description,
        quantity: quantity,
        unit_price_usd: unitPriceUsd,
        unit_price_ars: unitPriceArs,
        discount_percent: discountPercent,
        line_total: lineTotal,
        created_at: now,
      };
    });

    const taxAmount = netAmountArs * TAX_RATE;
    const totalAmount = netAmountArs + taxAmount;

    // Create invoice and invoice items in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the invoice
      const invoice = await tx.invoices.create({
        data: {
          invoice_number: invoiceNumber,
          sales_order_id: salesOrderId,
          invoice_date: now,
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

      // Create invoice items with USD to ARS conversion
      await tx.invoice_items.createMany({
        data: invoiceItemsData.map((item) => ({
          ...item,
          invoice_id: invoice.id,
        })),
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
          invoice_items: true,
          sales_orders: {
            include: {
              clients: true,
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

    // Track creation
    const tracker = new ChangeTracker();
    tracker.trackCreate('invoice', result.id, result);

    // Log activity
    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.INVOICE_CREATE,
      description: `Factura ${invoiceNumber} generada desde pedido ${salesOrder.order_number}`,
      entityType: 'invoice',
      entityId: result.id,
      details: { 
        invoiceNumber,
        orderNumber: salesOrder.order_number,
        totalAmount: Number(totalAmount)
      }
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

    return NextResponse.json(mappedInvoice, { status: 201 });
  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: 'Error al generar la factura' },
      { status: 500 }
    );
  }
}


