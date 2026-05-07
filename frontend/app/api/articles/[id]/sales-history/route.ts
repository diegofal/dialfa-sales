import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const articleId = BigInt(id);
    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(sp.get('limit') || '25', 10)));
    const from = sp.get('from') ? new Date(sp.get('from')!) : null;
    const to = sp.get('to') ? new Date(sp.get('to')!) : null;

    const where = {
      article_id: articleId,
      invoices: {
        is_printed: true,
        is_cancelled: false,
        deleted_at: null,
        ...(from || to
          ? {
              invoice_date: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lt: to } : {}),
              },
            }
          : {}),
      },
    } as const;

    const [rows, totalRow, aggregate] = await Promise.all([
      prisma.invoice_items.findMany({
        where,
        include: {
          invoices: {
            include: {
              sales_orders: { include: { clients: { select: { id: true, business_name: true } } } },
            },
          },
        },
        orderBy: [{ invoices: { invoice_date: 'desc' } }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice_items.count({ where }),
      prisma.invoice_items.aggregate({
        where,
        _sum: { quantity: true, line_total: true },
      }),
    ]);

    const data = rows.map((r) => ({
      invoiceItemId: Number(r.id),
      invoiceId: Number(r.invoice_id),
      invoiceNumber: r.invoices.invoice_number,
      invoiceDate: r.invoices.invoice_date.toISOString(),
      clientId: r.invoices.sales_orders.clients?.id
        ? Number(r.invoices.sales_orders.clients.id)
        : null,
      clientName: r.invoices.sales_orders.clients?.business_name ?? '—',
      quantity: r.quantity,
      unitPriceUsd: Number(r.unit_price_usd),
      unitPriceArs: Number(r.unit_price_ars),
      discountPercent: Number(r.discount_percent),
      lineTotal: Number(r.line_total),
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: totalRow,
        totalPages: Math.ceil(totalRow / limit),
      },
      totals: {
        units: Number(aggregate._sum.quantity ?? 0),
        revenueArs: Number(aggregate._sum.line_total ?? 0),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
