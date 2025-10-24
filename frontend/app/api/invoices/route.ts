import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapInvoiceToDTO } from '@/lib/utils/mapper';
import { createInvoiceSchema } from '@/lib/validations/schemas';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const isCancelled = searchParams.get('isCancelled');

    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      deleted_at: null,
    };

    if (search) {
      where.OR = [
        { invoice_number: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isCancelled !== null && isCancelled !== undefined) {
      where.is_cancelled = isCancelled === 'true';
    }

    // Get invoices with sales order and client
    const [invoices, total] = await Promise.all([
      prisma.invoices.findMany({
        where,
        include: {
          sales_orders: {
            include: {
              clients: true,
              sales_order_items: true,
            },
          },
        },
        orderBy: {
          invoice_date: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.invoices.count({ where }),
    ]);

    // Map to DTO format (snake_case to camelCase)
    const mappedInvoices = invoices.map(mapInvoiceToDTO);

    return NextResponse.json({
      data: mappedInvoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = createInvoiceSchema.parse(body);

    // Check if sales order exists
    const salesOrder = await prisma.sales_orders.findUnique({
      where: { id: validatedData.salesOrderId },
      include: {
        sales_order_items: true,
        invoices: {
          where: {
            deleted_at: null,
            is_cancelled: false,
          },
        },
      },
    });

    if (!salesOrder || salesOrder.deleted_at) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Check if already invoiced (unless creating credit note or quotation)
    if (!validatedData.isCreditNote && !validatedData.isQuotation && salesOrder.invoices.length > 0) {
      return NextResponse.json(
        { error: 'Sales order already has an invoice' },
        { status: 400 }
      );
    }

    // Generate invoice number (format: INV-YYYYMMDD-XXXX)
    const now = new Date();
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

    // Calculate amounts from sales order
    // Assuming 21% tax rate (IVA) - you may want to make this configurable
    const TAX_RATE = 0.21;
    const netAmount = parseFloat(salesOrder.total.toString());
    const taxAmount = netAmount * TAX_RATE;
    const totalAmount = netAmount + taxAmount;

    // Create invoice and update sales order in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the invoice
      const invoice = await tx.invoices.create({
        data: {
          invoice_number: invoiceNumber,
          sales_order_id: validatedData.salesOrderId,
          invoice_date: validatedData.invoiceDate || now,
          net_amount: netAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          usd_exchange_rate: validatedData.usdExchangeRate,
          is_credit_note: validatedData.isCreditNote ?? false,
          is_quotation: validatedData.isQuotation ?? false,
          notes: validatedData.notes,
          created_at: now,
          updated_at: now,
        },
      });

      // Update sales order status to INVOICED (unless it's a quotation)
      if (!validatedData.isQuotation) {
        await tx.sales_orders.update({
          where: { id: validatedData.salesOrderId },
          data: {
            status: 'INVOICED',
            updated_at: now,
          },
        });
      }

      // Return the full invoice with relations
      return await tx.invoices.findUnique({
        where: { id: invoice.id },
        include: {
          sales_orders: {
            include: {
              clients: true,
              sales_order_items: true,
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
    console.error('Error creating invoice:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}

