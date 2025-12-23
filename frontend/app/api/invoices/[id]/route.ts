import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapInvoiceToDTO } from '@/lib/utils/mapper';
import { updateInvoiceSchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { STOCK_MOVEMENT_TYPES } from '@/lib/constants/stockMovementTypes';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

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
        invoice_items: {
          include: {
            articles: true
          }
        },
        sales_orders: {
          include: {
            clients: {
              include: {
                tax_conditions: true,
              },
            },
            sales_order_items: {
              include: {
                articles: {
                  include: {
                    stock_movements: {
                      where: {
                        reference_document: {
                          contains: idStr
                        }
                      },
                      orderBy: {
                        created_at: 'desc'
                      }
                    }
                  }
                }
              }
            }
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

    // Map to DTO format (snake_case to camelCase)
    const mappedInvoice = mapInvoiceToDTO(invoice);

    return NextResponse.json(mappedInvoice);
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
    const isCancellingPrintedInvoice = (body.is_cancelled === true || body.isCancelled === true) &&
      !existingInvoice.is_cancelled &&
      existingInvoice.is_printed;
    if (body.is_cancelled === true || body.isCancelled === true) {
      updateData.is_cancelled = true;
      updateData.cancelled_at = now;
      if (body.cancellation_reason || body.cancellationReason) {
        updateData.cancellation_reason = body.cancellation_reason || body.cancellationReason;
      }
    }

    // Handle printing
    const isPrintingNow = (body.is_printed === true || body.isPrinted === true) && !existingInvoice.is_printed;
    if (body.is_printed === true || body.isPrinted === true) {
      updateData.is_printed = true;
      if (!existingInvoice.printed_at) {
        updateData.printed_at = now;
      }
    }

    // Update invoice and potentially sales order status in transaction
    const invoice = await prisma.$transaction(async (tx) => {
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
                notes: `Stock devuelto por cancelación de factura impresa: ${body.cancellation_reason || body.cancellationReason || 'Sin razón especificada'}`,
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

      // If printing the invoice for the first time, debit stock
      if (isPrintingNow) {
        // Get sales order items to debit stock
        const salesOrder = await tx.sales_orders.findUnique({
          where: { id: existingInvoice.sales_order_id },
          include: {
            sales_order_items: true,
          },
        });

        if (salesOrder) {
          for (const item of salesOrder.sales_order_items) {
            // Create negative stock movement (debit from stock)
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

            // Update article stock
            await tx.articles.update({
              where: { id: item.article_id },
              data: {
                stock: {
                  decrement: item.quantity,
                },
                updated_at: now,
              },
            });
          }
        }
      }

      // Update the invoice
      const updatedInvoice = await tx.invoices.update({
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

      // If invoice was cancelled, check if we need to update sales order status
      if (updateData.is_cancelled) {
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

        // If no active invoices remain, set order status back to PENDING
        if (salesOrder && salesOrder.invoices.length === 0) {
          await tx.sales_orders.update({
            where: { id: existingInvoice.sales_order_id },
            data: {
              status: 'PENDING',
              updated_at: now,
            },
          });
        }
      }

      return updatedInvoice;
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

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.INVOICE_UPDATE,
      description: `Factura ${existingInvoice.invoice_number} actualizada`,
      entityType: 'invoice',
      entityId: id,
      details: { 
        invoiceNumber: existingInvoice.invoice_number,
        wasCancelled: updateData.is_cancelled,
        wasPrinted: isPrintingNow
      }
    });

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

    // Soft delete invoice and update sales order status in transaction
    await prisma.$transaction(async (tx) => {
      // Soft delete the invoice
      await tx.invoices.update({
        where: { id },
        data: {
          deleted_at: now,
          updated_at: now,
        },
      });

      // Update sales order status back to PENDING if this was the only invoice
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

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.INVOICE_DELETE,
      description: `Factura ${existingInvoice.invoice_number} eliminada`,
      entityType: 'invoice',
      entityId: id,
      details: { invoiceNumber: existingInvoice.invoice_number }
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

