import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as PriceListService from '@/lib/services/PriceListService';

export async function GET(request: NextRequest) {
  try {
    const { authorized, error } = requireAdmin(request);
    if (!authorized) return error!;

    const searchParams = request.nextUrl.searchParams;
    const result = await PriceListService.getHistory({
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
      articleId: searchParams.get('articleId') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      changeType: searchParams.get('changeType') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
