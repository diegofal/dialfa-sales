import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as ArticleService from '@/lib/services/ArticleService';
import { createArticleSchema } from '@/lib/validations/schemas';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const result = await ArticleService.list({
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
      search: searchParams.get('search') || '',
      categoryId: searchParams.get('categoryId') || undefined,
      isActive: searchParams.get('isActive') ?? undefined,
      includeABC: searchParams.get('includeABC') === 'true',
      abcFilter: searchParams.get('abcFilter') || undefined,
      salesSort: searchParams.get('salesSort') || undefined,
      trendMonths: parseInt(searchParams.get('trendMonths') || '12'),
      lowStockOnly: searchParams.get('lowStockOnly') === 'true',
      hasStockOnly: searchParams.get('hasStockOnly') === 'true',
      zeroStockOnly: searchParams.get('zeroStockOnly') === 'true',
      ids: searchParams.get('ids') || undefined,
      includeTrends: searchParams.get('includeTrends') === 'true',
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Solo los administradores pueden crear artículos' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = createArticleSchema.parse(body);
    const article = await ArticleService.create(validatedData, request);
    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
