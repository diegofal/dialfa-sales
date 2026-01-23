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
    const result = await PriceListService.bulkUpdate(body, user?.userId, user?.email, request);

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
