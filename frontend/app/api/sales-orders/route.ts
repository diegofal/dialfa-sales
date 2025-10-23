import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapSalesOrderToDTO } from '@/lib/utils/mapper';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');

    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      deleted_at: null,
    };

    if (search) {
      where.OR = [
        { order_number: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (clientId) {
      where.client_id = BigInt(clientId);
    }

    // Get sales orders with client and items
    const [salesOrders, total] = await Promise.all([
      prisma.sales_orders.findMany({
        where,
        include: {
          clients: true,
          sales_order_items: {
            include: {
              articles: true,
            },
          },
        },
        orderBy: {
          order_date: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.sales_orders.count({ where }),
    ]);

    // Map to DTO format (snake_case to camelCase)
    const mappedSalesOrders = salesOrders.map(mapSalesOrderToDTO);

    return NextResponse.json({
      data: mappedSalesOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales orders' },
      { status: 500 }
    );
  }
}


