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

    // Get invoices with invoice_items instead of sales_order_items
    const [invoices, total] = await Promise.all([
      prisma.invoices.findMany({
        where,
        include: {
          invoice_items: true,
          sales_orders: {
            include: {
              clients: true,
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
        sales_order_items: {
          include: {
            articles: true,
          },
        },
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

    // Get USD exchange rate: use provided value or fetch from system settings
    let usdExchangeRate = validatedData.usdExchangeRate;
    if (!usdExchangeRate) {
      const settings = await prisma.system_settings.findUnique({
        where: { id: 1 },
      });
      usdExchangeRate = settings ? parseFloat(settings.usd_exchange_rate.toString()) : 1.0;
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

    // Calculate amounts with USD to ARS conversion
    // Tax rate (IVA) - 21%
    const TAX_RATE = 0.21;
    
    let netAmountArs = 0;
    
    // Prepare invoice items with conversion
    const invoiceItemsData = salesOrder.sales_order_items.map((item) => {
      const unitPriceUsd = parseFloat(item.unit_price.toString());
      const unitPriceArs = unitPriceUsd * usdExchangeRate;
      const discountPercent = parseFloat(item.discount_percent.toString());
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
          sales_order_id: validatedData.salesOrderId,
          invoice_date: validatedData.invoiceDate || now,
          net_amount: netAmountArs,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          usd_exchange_rate: usdExchangeRate,
          is_credit_note: validatedData.isCreditNote ?? false,
          is_quotation: validatedData.isQuotation ?? false,
          notes: validatedData.notes,
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

