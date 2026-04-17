import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';

interface CostRow {
  year_month: string;
  source: string;
  category: string;
  amount_ars: number;
  amount_usd: number | null;
  exchange_rate: number | null;
}

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const rows = await prisma.$queryRawUnsafe<CostRow[]>(
      `SELECT year_month, source, category,
              amount_ars::float, amount_usd::float, exchange_rate::float
       FROM monthly_costs
       ORDER BY year_month, source, category`
    );

    // Group by year_month
    const grouped: Record<string, CostRow[]> = {};
    for (const row of rows) {
      if (!grouped[row.year_month]) grouped[row.year_month] = [];
      grouped[row.year_month].push(row);
    }

    return NextResponse.json({
      costs: grouped,
      months: Object.keys(grouped).sort(),
      totalRows: rows.length,
    });
  } catch (error) {
    return handleError(error);
  }
}
