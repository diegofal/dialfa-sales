import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

const updatePaymentTermSchema = z.object({
  paymentTermId: z.coerce.number().int().min(1, 'Payment term ID is required'),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);
    const body = await request.json();

    // Check if invoice exists and is not printed/cancelled
    const existingInvoice = await prisma.invoices.findUnique({
      where: { id },
      include: {
        sales_orders: {
          include: {
            clients: true,
          }
        },
        payment_terms: true,
        invoice_items: {
          include: {
            articles: {
              include: {
                categories: {
                  include: {
                    category_payment_discounts: true,
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!existingInvoice || existingInvoice.deleted_at) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (existingInvoice.is_printed) {
      return NextResponse.json(
        { error: 'No se puede modificar una factura impresa' },
        { status: 403 }
      );
    }

    if (existingInvoice.is_cancelled) {
      return NextResponse.json(
        { error: 'No se puede modificar una factura cancelada' },
        { status: 403 }
      );
    }

    // Validate input
    const { paymentTermId } = updatePaymentTermSchema.parse(body);

    const now = new Date();
    const usdExchangeRate = parseFloat(existingInvoice.usd_exchange_rate?.toString() || '1000');
    const TAX_RATE = 0.21; // 21% IVA
    
    // Recalculate all invoice items with new payment term discounts
    let netAmountArs = 0;
    
    const updatedItemsData = existingInvoice.invoice_items.map((item) => {
      const unitPriceUsd = parseFloat(item.unit_price_usd.toString());
      const unitPriceArs = unitPriceUsd * usdExchangeRate;
      const quantity = item.quantity;
      
      // Get discount based on NEW payment term and category
      // First try to find specific discount for this category and payment term
      const categoryPaymentDiscount = item.articles.categories?.category_payment_discounts?.find(
        cpd => cpd.payment_term_id === paymentTermId
      );
      
      // If specific discount exists, use it; otherwise fall back to default
      const discountPercent = categoryPaymentDiscount
        ? parseFloat(categoryPaymentDiscount.discount_percent.toString())
        : (item.articles.categories?.default_discount_percent 
            ? parseFloat(item.articles.categories.default_discount_percent.toString())
            : 0);
      
      // Calculate line total: (price * quantity) - discount
      const subtotal = unitPriceArs * quantity;
      const discount = subtotal * (discountPercent / 100);
      const lineTotal = subtotal - discount;
      
      netAmountArs += lineTotal;
      
      return {
        id: item.id,
        discountPercent,
        lineTotal,
      };
    });

    const taxAmount = netAmountArs * TAX_RATE;
    const totalAmount = netAmountArs + taxAmount;

    // Update in transaction to ensure consistency
    await prisma.$transaction(async (tx) => {
      // Update each invoice item with new discount and line total
      for (const itemData of updatedItemsData) {
        await tx.invoice_items.update({
          where: { id: itemData.id },
          data: {
            discount_percent: itemData.discountPercent,
            line_total: itemData.lineTotal,
          },
        });
      }

      // Update invoice with new payment term and recalculated totals
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

      // Update client payment_term_id
      const clientId = existingInvoice.sales_orders.client_id;
      await tx.clients.update({
        where: { id: clientId },
        data: {
          payment_term_id: paymentTermId,
          updated_at: now,
        },
      });
    });

    // Fetch updated invoice for response
    const updatedInvoice = await prisma.invoices.findUnique({
      where: { id },
      include: {
        payment_terms: true,
      },
    });

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.INVOICE_UPDATE,
      description: `Condición de pago actualizada en factura ${existingInvoice.invoice_number} - descuentos recalculados`,
      entityType: 'invoice',
      entityId: id,
      details: { 
        oldPaymentTermId: existingInvoice.payment_term_id,
        newPaymentTermId: paymentTermId,
        oldPaymentTermName: existingInvoice.payment_terms?.name,
        newPaymentTermName: updatedInvoice?.payment_terms?.name,
        clientUpdated: true,
        discountsRecalculated: true,
        itemsUpdated: updatedItemsData.length,
        oldTotal: Number(existingInvoice.total_amount),
        newTotal: Number(totalAmount),
      }
    });

    return NextResponse.json({
      success: true,
      paymentTermId: updatedInvoice?.payment_term_id,
      paymentTermName: updatedInvoice?.payment_terms?.name,
      itemsRecalculated: updatedItemsData.length,
      newTotal: totalAmount,
    });
  } catch (error) {
    console.error('Error updating invoice payment term:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update payment term' },
      { status: 500 }
    );
  }
}
