import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const articleId = BigInt(id);
    const months = Math.max(
      3,
      Math.min(36, parseInt(request.nextUrl.searchParams.get('months') || '24', 10))
    );

    // Monthly qty + revenue + cogs + margin (USD basis), reusing the same
    // canonical formula used by DashboardService margin: COGS = qty × FOB × (1 + CIF%/100).
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        month: Date;
        units: number | null;
        revenue_usd: number | null;
        revenue_ars: number | null;
        cogs_usd: number | null;
      }>
    >(
      `SELECT
        date_trunc('month', i.invoice_date) as month,
        COALESCE(SUM(ii.quantity), 0) as units,
        COALESCE(SUM(ii.unit_price_usd * ii.quantity * (1 - ii.discount_percent / 100)), 0) as revenue_usd,
        COALESCE(SUM(ii.line_total), 0) as revenue_ars,
        COALESCE(SUM(
          ii.quantity * COALESCE(a.last_purchase_price, 0) * (1 + COALESCE(a.cif_percentage, 50) / 100)
        ), 0) as cogs_usd
      FROM invoice_items ii
      INNER JOIN invoices i ON ii.invoice_id = i.id
      INNER JOIN articles a ON ii.article_id = a.id
      WHERE ii.article_id = $1
        AND i.is_printed = true
        AND i.is_cancelled = false
        AND i.deleted_at IS NULL
        AND i.invoice_date >= NOW() - ($2 || ' months')::interval
      GROUP BY date_trunc('month', i.invoice_date)
      ORDER BY month ASC`,
      articleId,
      months.toString()
    );

    const data = rows.map((r) => {
      const revenueUsd = Number(r.revenue_usd ?? 0);
      const cogsUsd = Number(r.cogs_usd ?? 0);
      const marginPct = revenueUsd > 0 ? ((revenueUsd - cogsUsd) / revenueUsd) * 100 : null;
      return {
        month: r.month.toISOString().slice(0, 7), // YYYY-MM
        units: Number(r.units ?? 0),
        revenueUsd,
        revenueArs: Number(r.revenue_ars ?? 0),
        cogsUsd,
        marginPercent: marginPct,
      };
    });

    return NextResponse.json({ data, months });
  } catch (error) {
    return handleError(error);
  }
}
