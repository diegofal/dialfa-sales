import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { updateInvoiceSchema } from '@/lib/validations/schemas';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    const invoice = await prisma.invoices.findUnique({
      where: { id },
      include: {
        sales_orders: {
          include: {
            clients: {
              include: {
                tax_conditions: true,
                operation_types: true,
              },
            },
            sales_order_items: {
              include: {
                articles: {
                  include: {
                    categories: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice || invoice.deleted_at) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Convert BigInt to string for JSON serialization
    const serializedInvoice = {
      ...invoice,
      id: invoice.id.toString(),
      sales_order_id: invoice.sales_order_id.toString(),
      sales_orders: {
        ...invoice.sales_orders,
        id: invoice.sales_orders.id.toString(),
        client_id: invoice.sales_orders.client_id.toString(),
        clients: {
          ...invoice.sales_orders.clients,
          id: invoice.sales_orders.clients.id.toString(),
        },
        sales_order_items: invoice.sales_orders.sales_order_items.map((item: typeof invoice.sales_orders.sales_order_items[number]) => ({
          ...item,
          id: item.id.toString(),
          sales_order_id: item.sales_order_id.toString(),
          article_id: item.article_id.toString(),
          articles: {
            ...item.articles,
            id: item.articles.id.toString(),
            category_id: item.articles.category_id.toString(),
            categories: {
              ...item.articles.categories,
              id: item.articles.categories.id.toString(),
            },
          },
        })),
      },
    };

    return NextResponse.json(serializedInvoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);
    const body = await request.json();

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

    // Check if invoice is cancelled
    if (existingInvoice.is_cancelled) {
      return NextResponse.json(
        { error: 'Cannot edit cancelled invoices' },
        { status: 400 }
      );
    }

    // Validate input
    const validatedData = updateInvoiceSchema.parse(body);

    const now = new Date();

    // Prepare update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      updated_at: now,
    };

    if (validatedData.salesOrderId !== undefined) {
      updateData.sales_order_id = validatedData.salesOrderId;
    }
    if (validatedData.invoiceDate !== undefined) {
      updateData.invoice_date = validatedData.invoiceDate;
    }
    if (validatedData.usdExchangeRate !== undefined) {
      updateData.usd_exchange_rate = validatedData.usdExchangeRate;
    }
    if (validatedData.isCreditNote !== undefined) {
      updateData.is_credit_note = validatedData.isCreditNote;
    }
    if (validatedData.isQuotation !== undefined) {
      updateData.is_quotation = validatedData.isQuotation;
    }
    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    // Handle cancellation
    if (body.is_cancelled === true || body.isCancelled === true) {
      updateData.is_cancelled = true;
      updateData.cancelled_at = now;
      if (body.cancellation_reason || body.cancellationReason) {
        updateData.cancellation_reason = body.cancellation_reason || body.cancellationReason;
      }
    }

    // Handle printing
    if (body.is_printed === true || body.isPrinted === true) {
      updateData.is_printed = true;
      if (!existingInvoice.printed_at) {
        updateData.printed_at = now;
      }
    }

    // Update invoice
    const invoice = await prisma.invoices.update({
      where: { id },
      data: updateData,
      include: {
        sales_orders: {
          include: {
            clients: true,
            sales_order_items: true,
          },
        },
      },
    });

    // Convert BigInt to string for JSON serialization
    const serializedInvoice = {
      ...invoice,
      id: invoice.id.toString(),
      sales_order_id: invoice.sales_order_id.toString(),
      sales_orders: {
        ...invoice.sales_orders,
        id: invoice.sales_orders.id.toString(),
        client_id: invoice.sales_orders.client_id.toString(),
        clients: {
          ...invoice.sales_orders.clients,
          id: invoice.sales_orders.clients.id.toString(),
        },
        sales_order_items: invoice.sales_orders.sales_order_items.map((item: typeof invoice.sales_orders.sales_order_items[number]) => ({
          ...item,
          id: item.id.toString(),
          sales_order_id: item.sales_order_id.toString(),
          article_id: item.article_id.toString(),
        })),
      },
    };

    return NextResponse.json(serializedInvoice);
  } catch (error) {
    console.error('Error updating invoice:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    // Check if invoice exists and is not already deleted
    const existingInvoice = await prisma.invoices.findUnique({
      where: { id },
    });

    if (!existingInvoice || existingInvoice.deleted_at) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Only allow deletion if not printed and not cancelled
    if (existingInvoice.is_printed) {
      return NextResponse.json(
        { error: 'Cannot delete printed invoices' },
        { status: 400 }
      );
    }

    if (existingInvoice.is_cancelled) {
      return NextResponse.json(
        { error: 'Cannot delete cancelled invoices' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Soft delete invoice
    await prisma.invoices.update({
      where: { id },
      data: {
        deleted_at: now,
        updated_at: now,
      },
    });

    return NextResponse.json(
      { message: 'Invoice deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    );
  }
}

