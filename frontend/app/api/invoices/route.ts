import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { InvoiceWhereInput } from '@/lib/types';
import { mapInvoiceToDTO } from '@/lib/utils/mapper';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const isCancelled = searchParams.get('isCancelled');

    const skip = (page - 1) * limit;

    // Build where clause
    const where: InvoiceWhereInput = {
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


