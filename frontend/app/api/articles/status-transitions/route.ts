import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as StockSnapshotService from '@/lib/services/StockSnapshotService';
import { StockStatus } from '@/types/stockValuation';

const VALID_STATUSES = new Set<string>(Object.values(StockStatus));

function parseStatusParam(value: string | null): StockStatus | undefined {
  if (!value) return undefined;
  return VALID_STATUSES.has(value) ? (value as StockStatus) : undefined;
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;

    const toDate = parseDateParam(params.get('toDate')) ?? new Date();
    let fromDate = parseDateParam(params.get('fromDate'));

    if (!fromDate) {
      fromDate = new Date(toDate);
      fromDate.setUTCDate(fromDate.getUTCDate() - 30);
    }

    if (fromDate.getTime() > toDate.getTime()) {
      return NextResponse.json(
        { error: 'fromDate must be earlier than or equal to toDate' },
        { status: 400 }
      );
    }

    fromDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCHours(23, 59, 59, 999);

    const minStockValueRaw = params.get('minStockValue');
    const minStockValue = minStockValueRaw !== null ? Number(minStockValueRaw) : undefined;
    if (minStockValue !== undefined && Number.isNaN(minStockValue)) {
      return NextResponse.json({ error: 'minStockValue must be a number' }, { status: 400 });
    }

    const limitRaw = params.get('limit');
    const limit = limitRaw !== null ? parseInt(limitRaw, 10) : undefined;
    if (limit !== undefined && (Number.isNaN(limit) || limit < 0)) {
      return NextResponse.json({ error: 'limit must be a non-negative integer' }, { status: 400 });
    }

    const result = await StockSnapshotService.getTransitions(fromDate, toDate, {
      fromStatus: parseStatusParam(params.get('fromStatus')),
      toStatus: parseStatusParam(params.get('toStatus')),
      minStockValue,
      limit,
    });

    return NextResponse.json({ data: result, status: 'success' });
  } catch (error) {
    return handleError(error);
  }
}
