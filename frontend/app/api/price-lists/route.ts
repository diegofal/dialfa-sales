import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as PriceListService from '@/lib/services/PriceListService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const result = await PriceListService.list({
      categoryId: searchParams.get('categoryId') || undefined,
      search: searchParams.get('search') || undefined,
      activeOnly: searchParams.get('activeOnly') === 'true',
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
