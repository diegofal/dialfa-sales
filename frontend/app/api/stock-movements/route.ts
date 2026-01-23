import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as ArticleService from '@/lib/services/ArticleService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const result = await ArticleService.listStockMovements({
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
      articleId: searchParams.get('articleId') || undefined,
      movementType: searchParams.get('movementType') || undefined,
      startDate: searchParams.get('fromDate') || searchParams.get('startDate') || undefined,
      endDate: searchParams.get('toDate') || searchParams.get('endDate') || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
