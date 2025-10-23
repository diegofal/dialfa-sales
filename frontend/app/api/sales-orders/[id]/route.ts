import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
        clients: {
          include: {
            tax_conditions: true,
            operation_types: true,
            client_discounts: {
              include: {
                categories: true,
              },
            },
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
          orderBy: {
            id: 'asc',
          },
        },
        invoices: true,
        delivery_notes: true,
      },
    });

    if (!salesOrder || salesOrder.deleted_at) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Convert BigInt to string for JSON serialization
    const serializedSalesOrder = {
      ...salesOrder,
      id: salesOrder.id.toString(),
      client_id: salesOrder.client_id.toString(),
      clients: {
        ...salesOrder.clients,
        id: salesOrder.clients.id.toString(),
        client_discounts: salesOrder.clients.client_discounts.map(discount => ({
          ...discount,
          id: discount.id.toString(),
          client_id: discount.client_id.toString(),
          category_id: discount.category_id.toString(),
          categories: {
            ...discount.categories,
            id: discount.categories.id.toString(),
          },
        })),
      },
      sales_order_items: salesOrder.sales_order_items.map(item => ({
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
      invoices: salesOrder.invoices.map(invoice => ({
        ...invoice,
        id: invoice.id.toString(),
        sales_order_id: invoice.sales_order_id.toString(),
      })),
      delivery_notes: salesOrder.delivery_notes.map(note => ({
        ...note,
        id: note.id.toString(),
        sales_order_id: note.sales_order_id.toString(),
      })),
    };

    return NextResponse.json(serializedSalesOrder);
  } catch (error) {
    console.error('Error fetching sales order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales order' },
      { status: 500 }
    );
  }
}

