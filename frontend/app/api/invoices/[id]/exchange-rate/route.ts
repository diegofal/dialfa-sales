import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateExchangeRateSchema = z.object({
  usdExchangeRate: z.number().positive('Exchange rate must be positive'),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);
    const body = await request.json();

    // Validate input
    const validatedData = updateExchangeRateSchema.parse(body);

    // Check if invoice exists
    const existingInvoice = await prisma.invoices.findUnique({
      where: { id },
      include: {
        invoice_items: true,
      },
    });

    if (!existingInvoice || existingInvoice.deleted_at) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Cannot edit if printed or cancelled
    if (existingInvoice.is_printed) {
      return NextResponse.json(
        { error: 'Cannot edit printed invoices' },
        { status: 400 }
      );
    }

    if (existingInvoice.is_cancelled) {
      return NextResponse.json(
        { error: 'Cannot edit cancelled invoices' },
        { status: 400 }
      );
    }

    const now = new Date();
    const newExchangeRate = validatedData.usdExchangeRate;
    const TAX_RATE = 0.21;

    // Update invoice and recalculate all items in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Recalculate all invoice items with new exchange rate
      let totalNetAmount = 0;

      for (const item of existingInvoice.invoice_items) {
        const unitPriceUsd = parseFloat(item.unit_price_usd.toString());
        const unitPriceArs = unitPriceUsd * newExchangeRate;
        const quantity = item.quantity;
        const discountPercent = parseFloat(item.discount_percent.toString());
        
        // Calculate line total
        const subtotal = unitPriceArs * quantity;
        const discount = subtotal * (discountPercent / 100);
        const lineTotal = subtotal - discount;
        
        totalNetAmount += lineTotal;

        // Update the item
        await tx.invoice_items.update({
          where: { id: item.id },
          data: {
            unit_price_ars: unitPriceArs,
            line_total: lineTotal,
          },
        });
      }

      // Calculate totals
      const taxAmount = totalNetAmount * TAX_RATE;
      const totalAmount = totalNetAmount + taxAmount;

      // Update invoice with new exchange rate and totals
      const updatedInvoice = await tx.invoices.update({
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
          sales_orders: {
            include: {
              clients: {
                include: {
                  tax_conditions: true,
                },
              },
            },
          },
        },
      });

      return updatedInvoice;
    });

    // Map to DTO format
    const response = {
      id: result.id.toString(),
      invoiceNumber: result.invoice_number,
      usdExchangeRate: result.usd_exchange_rate ? parseFloat(result.usd_exchange_rate.toString()) : null,
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
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating exchange rate:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update exchange rate' },
      { status: 500 }
    );
  }
}

