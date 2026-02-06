import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as PriceListService from '@/lib/services/PriceListService';

export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request);
    if (!auth.authorized) {
      return auth.error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = await PriceListService.bulkUpdate(
      body,
      auth.user?.userId,
      auth.user?.email,
      request
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
