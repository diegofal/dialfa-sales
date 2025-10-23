import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

