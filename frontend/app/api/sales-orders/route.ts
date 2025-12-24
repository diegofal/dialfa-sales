import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapSalesOrderToDTO } from '@/lib/utils/mapper';
import { createSalesOrderSchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

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
          invoices: {
            select: {
              id: true,
              invoice_number: true,
              is_printed: true,
              is_cancelled: true,
            },
            where: {
              deleted_at: null,
            },
            orderBy: {
              created_at: 'desc',
            },
            take: 1,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = createSalesOrderSchema.parse(body);

    // Calculate totals for each item and overall total
    const itemsData = validatedData.items.map((item) => {
      const lineTotal = item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
      return {
        article_id: item.articleId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent,
        line_total: lineTotal,
      };
    });

    const subtotal = itemsData.reduce((sum, item) => sum + item.line_total, 0);
    const total = subtotal * (1 - validatedData.specialDiscountPercent / 100);

    // Create sales order with items in transaction
    // Generate order number INSIDE transaction to avoid race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Generate order number (format: SO-YYYYMMDD-XXXX)
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Get count of orders today to generate sequence - INSIDE transaction
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      
      // Use FOR UPDATE to lock the rows and prevent race conditions
      // Get the highest sequence number for today
      const lastOrder = await tx.sales_orders.findFirst({
        where: {
          order_number: {
            startsWith: `SO-${dateStr}-`,
          },
        },
        orderBy: {
          order_number: 'desc',
        },
        select: {
          order_number: true,
        },
      });
      
      let sequence = 1;
      if (lastOrder) {
        // Extract sequence from order number (SO-YYYYMMDD-XXXX)
        const lastSequence = parseInt(lastOrder.order_number.split('-')[2]);
        sequence = lastSequence + 1;
      }
      
      const orderNumber = `SO-${dateStr}-${String(sequence).padStart(4, '0')}`;
      
      // Create the sales order - use current date for orderDate
      const salesOrder = await tx.sales_orders.create({
        data: {
          client_id: validatedData.clientId,
          order_number: orderNumber,
          order_date: now, // Use current date
          delivery_date: null, // No delivery date by default
          status: validatedData.status || 'PENDING',
          special_discount_percent: validatedData.specialDiscountPercent,
          total: total,
          notes: validatedData.notes,
          created_at: now,
          updated_at: now,
        },
      });

      // Create sales order items
      const itemsWithOrderId = itemsData.map((item) => ({
        ...item,
        sales_order_id: salesOrder.id,
        created_at: now,
      }));

      await tx.sales_order_items.createMany({
        data: itemsWithOrderId,
      });

      // Return the full sales order with relations
      return await tx.sales_orders.findUnique({
        where: { id: salesOrder.id },
        include: {
          clients: true,
          sales_order_items: {
            include: {
              articles: true,
            },
          },
        },
      });
    });

    if (!result) {
      throw new Error('Failed to create sales order');
    }

    // Map to DTO format
    const mappedSalesOrder = mapSalesOrderToDTO(result);

    // Track creation
    const tracker = new ChangeTracker();
    tracker.trackCreate('sales_order', result.id, result);

    // Log activity
    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.ORDER_CREATE,
      description: `Pedido ${result.order_number} creado para cliente ${result.clients.business_name}`,
      entityType: 'sales_order',
      entityId: result.id,
      details: { total: Number(result.total), itemsCount: result.sales_order_items.length }
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

    return NextResponse.json(mappedSalesOrder, { status: 201 });
  } catch (error) {
    console.error('Error creating sales order:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create sales order' },
      { status: 500 }
    );
  }
}

