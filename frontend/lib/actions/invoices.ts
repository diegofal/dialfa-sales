'use server';

import { getErrorMessage } from '@/lib/utils/errors';

import { prisma } from '@/lib/db';
import { createInvoiceSchema, updateInvoiceSchema, type CreateInvoiceInput, type UpdateInvoiceInput } from '@/lib/validations/schemas';
import { revalidatePath } from 'next/cache';

// Generate invoice number (12-digit format)
async function generateInvoiceNumber(): Promise<string> {
  const lastInvoice = await prisma.invoices.findFirst({
    where: {
      deleted_at: null,
    },
    orderBy: {
      invoice_number: 'desc',
    },
  });

  let nextNumber = 1;
  if (lastInvoice) {
    const currentNumber = parseInt(lastInvoice.invoice_number);
    if (!isNaN(currentNumber)) {
      nextNumber = currentNumber + 1;
    }
  }

  return nextNumber.toString().padStart(12, '0');
}

export async function createInvoice(data: CreateInvoiceInput) {
  try {
    const validated = createInvoiceSchema.parse(data);

    // Get sales order
    const salesOrder = await prisma.sales_orders.findUnique({
      where: { id: validated.salesOrderId },
      include: {
        clients: {
          include: {
            tax_conditions: true,
          },
        },
        sales_order_items: true,
      },
    });

    if (!salesOrder || salesOrder.deleted_at) {
      return {
        success: false,
        error: 'Pedido de venta no encontrado',
      };
    }

    // Validate sales order status
    if (salesOrder.status !== 'PENDING') {
      return {
        success: false,
        error: `No se puede crear una factura desde un pedido con estado ${salesOrder.status}`,
      };
    }

    // Check if invoice already exists for this sales order
    const existingInvoice = await prisma.invoices.findFirst({
      where: {
        sales_order_id: validated.salesOrderId,
        deleted_at: null,
      },
    });

    if (existingInvoice) {
      return {
        success: false,
        error: 'Ya existe una factura para este pedido',
      };
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Calculate totals
    const usdExchangeRate = validated.usdExchangeRate || 1;
    const netAmount = Number(salesOrder.total) * usdExchangeRate;

    // Calculate tax (simplified - 21% IVA)
    const taxAmount = netAmount * 0.21;
    const totalAmount = netAmount + taxAmount;

    // Create invoice
    const invoice = await prisma.invoices.create({
      data: {
        invoice_number: invoiceNumber,
        sales_order_id: validated.salesOrderId,
        invoice_date: validated.invoiceDate,
        usd_exchange_rate: validated.usdExchangeRate,
        net_amount: netAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: validated.notes,
        is_printed: false,
        is_cancelled: false,
        is_credit_note: validated.isCreditNote,
        is_quotation: validated.isQuotation,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Update sales order status
    await prisma.sales_orders.update({
      where: { id: validated.salesOrderId },
      data: {
        status: 'INVOICED',
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard/sales-orders');
    revalidatePath(`/dashboard/sales-orders/${validated.salesOrderId.toString()}`);

    return {
      success: true,
      data: {
        ...invoice,
        id: invoice.id.toString(),
        sales_order_id: invoice.sales_order_id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error creating invoice:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to create invoice',
    };
  }
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput) {
  try {
    const invoiceId = BigInt(id);
    const validated = updateInvoiceSchema.parse(data);

    const existing = await prisma.invoices.findUnique({
      where: { id: invoiceId },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Factura no encontrada',
      };
    }

    if (existing.is_cancelled) {
      return {
        success: false,
        error: 'No se puede editar una factura cancelada',
      };
    }

    if (existing.is_printed) {
      return {
        success: false,
        error: 'No se puede editar una factura impresa',
      };
    }

    const invoice = await prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        ...validated,
        sales_order_id: validated.salesOrderId,
        invoice_date: validated.invoiceDate,
        usd_exchange_rate: validated.usdExchangeRate,
        is_credit_note: validated.isCreditNote,
        is_quotation: validated.isQuotation,
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${id}`);

    return {
      success: true,
      data: {
        ...invoice,
        id: invoice.id.toString(),
        sales_order_id: invoice.sales_order_id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error updating invoice:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to update invoice',
    };
  }
}

export async function cancelInvoice(id: string, reason: string) {
  try {
    const invoiceId = BigInt(id);

    const existing = await prisma.invoices.findUnique({
      where: { id: invoiceId },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Factura no encontrada',
      };
    }

    if (existing.is_cancelled) {
      return {
        success: false,
        error: 'La factura ya está cancelada',
      };
    }

    const invoice = await prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        is_cancelled: true,
        cancelled_at: new Date(),
        cancellation_reason: reason,
        updated_at: new Date(),
      },
    });

    // Update sales order status back to PENDING
    await prisma.sales_orders.update({
      where: { id: existing.sales_order_id },
      data: {
        status: 'PENDING',
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${id}`);
    revalidatePath(`/dashboard/sales-orders/${existing.sales_order_id.toString()}`);

    return {
      success: true,
      message: 'Factura cancelada correctamente',
      data: {
        ...invoice,
        id: invoice.id.toString(),
        sales_order_id: invoice.sales_order_id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error cancelling invoice:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to cancel invoice',
    };
  }
}

export async function printInvoice(id: string) {
  try {
    const invoiceId = BigInt(id);

    const existing = await prisma.invoices.findUnique({
      where: { id: invoiceId },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Factura no encontrada',
      };
    }

    if (existing.is_cancelled) {
      return {
        success: false,
        error: 'No se puede imprimir una factura cancelada',
      };
    }

    const invoice = await prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        is_printed: true,
        printed_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${id}`);

    return {
      success: true,
      message: 'Factura marcada como impresa',
      data: {
        ...invoice,
        id: invoice.id.toString(),
        sales_order_id: invoice.sales_order_id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error printing invoice:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to print invoice',
    };
  }
}

