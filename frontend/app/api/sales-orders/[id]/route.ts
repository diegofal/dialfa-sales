import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapSalesOrderToDTO } from '@/lib/utils/mapper';
import { updateSalesOrderSchema } from '@/lib/validations/schemas';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    const salesOrder = await prisma.sales_orders.findUnique({
      where: { id },
      include: {
        clients: true,
        sales_order_items: {
          include: {
            articles: true,
          },
          orderBy: {
            id: 'asc',
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
        delivery_notes: {
          select: {
            id: true,
            delivery_number: true,
            delivery_date: true,
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
    });

    if (!salesOrder || salesOrder.deleted_at) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Map to DTO format (snake_case to camelCase)
    const mappedSalesOrder = mapSalesOrderToDTO(salesOrder);

    return NextResponse.json(mappedSalesOrder);
  } catch (error) {
    console.error('Error fetching sales order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales order' },
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

    // Check if sales order exists and is not deleted
    const existingSalesOrder = await prisma.sales_orders.findUnique({
      where: { id },
      include: {
        invoices: {
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    if (!existingSalesOrder || existingSalesOrder.deleted_at) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Check permissions: cannot edit if invoice is printed
    const activeInvoice = existingSalesOrder.invoices[0];
    if (activeInvoice && activeInvoice.is_printed) {
      return NextResponse.json(
        { error: 'No se puede modificar un pedido con factura impresa' },
        { status: 403 }
      );
    }

    // Validate input
    const validatedData = updateSalesOrderSchema.parse(body);

    const now = new Date();

    // If items are included, update them in transaction
    if (validatedData.items && validatedData.items.length > 0) {
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
      const total = subtotal * (1 - (validatedData.specialDiscountPercent ?? 0) / 100);

      // Update in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Delete existing items
        await tx.sales_order_items.deleteMany({
          where: { sales_order_id: id },
        });

        // Update sales order
        const salesOrder = await tx.sales_orders.update({
          where: { id },
          data: {
            client_id: validatedData.clientId,
            order_date: validatedData.orderDate,
            delivery_date: validatedData.deliveryDate,
            status: validatedData.status,
            special_discount_percent: validatedData.specialDiscountPercent,
            total: total,
            notes: validatedData.notes,
            updated_at: now,
          },
        });

        // Create new items
        const itemsWithOrderId = itemsData.map((item) => ({
          ...item,
          sales_order_id: salesOrder.id,
          created_at: now,
          updated_at: now,
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
        throw new Error('Failed to update sales order');
      }

      // Convert BigInt to string for JSON serialization
      const serializedSalesOrder = {
        ...result,
        id: result.id.toString(),
        client_id: result.client_id.toString(),
        clients: {
          ...result.clients,
          id: result.clients.id.toString(),
        },
        sales_order_items: result.sales_order_items.map((item: typeof result.sales_order_items[number]) => ({
          ...item,
          id: item.id.toString(),
          sales_order_id: item.sales_order_id.toString(),
          article_id: item.article_id.toString(),
          articles: {
            ...item.articles,
            id: item.articles.id.toString(),
            category_id: item.articles.category_id.toString(),
          },
        })),
      };

      return NextResponse.json(serializedSalesOrder);
    } else {
      // Update only the sales order fields without items
      const salesOrder = await prisma.sales_orders.update({
        where: { id },
        data: {
          client_id: validatedData.clientId,
          order_date: validatedData.orderDate,
          delivery_date: validatedData.deliveryDate,
          status: validatedData.status,
          special_discount_percent: validatedData.specialDiscountPercent,
          notes: validatedData.notes,
          updated_at: now,
        },
        include: {
          clients: true,
          sales_order_items: {
            include: {
              articles: true,
            },
          },
        },
      });

      // Convert BigInt to string for JSON serialization
      const serializedSalesOrder = {
        ...salesOrder,
        id: salesOrder.id.toString(),
        client_id: salesOrder.client_id.toString(),
        clients: {
          ...salesOrder.clients,
          id: salesOrder.clients.id.toString(),
        },
        sales_order_items: salesOrder.sales_order_items.map((item: typeof salesOrder.sales_order_items[number]) => ({
          ...item,
          id: item.id.toString(),
          sales_order_id: item.sales_order_id.toString(),
          article_id: item.article_id.toString(),
          articles: {
            ...item.articles,
            id: item.articles.id.toString(),
            category_id: item.articles.category_id.toString(),
          },
        })),
      };

      return NextResponse.json(serializedSalesOrder);
    }
  } catch (error) {
    console.error('Error updating sales order:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update sales order' },
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

    // Check if sales order exists and is not already deleted
    const existingSalesOrder = await prisma.sales_orders.findUnique({
      where: { id },
      include: {
        invoices: {
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    if (!existingSalesOrder || existingSalesOrder.deleted_at) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Check permissions: cannot delete if has non-cancelled invoice
    const activeInvoice = existingSalesOrder.invoices[0];
    if (activeInvoice && !activeInvoice.is_cancelled) {
      return NextResponse.json(
        { error: 'No se puede eliminar un pedido con factura asociada' },
        { status: 403 }
      );
    }

    const now = new Date();

    // Soft delete sales order and its items in transaction
    await prisma.$transaction(async (tx) => {
      // Delete items (hard delete since they don't have deleted_at column)
      await tx.sales_order_items.deleteMany({
        where: { sales_order_id: id },
      });

      // Soft delete sales order
      await tx.sales_orders.update({
        where: { id },
        data: {
          deleted_at: now,
          updated_at: now,
        },
      });
    });

    return NextResponse.json(
      { message: 'Sales order deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting sales order:', error);
    return NextResponse.json(
      { error: 'Failed to delete sales order' },
      { status: 500 }
    );
  }
}

