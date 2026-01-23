import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as PriceListService from '@/lib/services/PriceListService';

export async function POST(request: NextRequest) {
  try {
    const { authorized, error, user } = requireAdmin(request);
    if (!authorized) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { priceHistoryId } = body;

    if (!priceHistoryId) {
      return NextResponse.json({ error: 'priceHistoryId is required' }, { status: 400 });
    }

    const result = await PriceListService.revertSingle(
      priceHistoryId,
      user?.userId,
      user?.email,
      request
    );

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, article: result.data });
  } catch (error) {
    return handleError(error);
  }
}
