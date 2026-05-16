import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import { getDeadStockMovements } from '@/lib/services/ReportsService';

const MAX_RANGE_DAYS = 366 * 2; // 2 años de tope para evitar abuso

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const from = parseDate(sp.get('from'));
    const to = parseDate(sp.get('to'));

    if (!from || !to) {
      return NextResponse.json({ error: 'from y to son requeridos (ISO 8601)' }, { status: 400 });
    }
    if (to.getTime() <= from.getTime()) {
      return NextResponse.json({ error: 'to debe ser posterior a from' }, { status: 400 });
    }

    const rangeDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `El rango excede el máximo permitido (${MAX_RANGE_DAYS} días)` },
        { status: 400 }
      );
    }

    const result = await getDeadStockMovements({ from, to });
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
