import { NextRequest, NextResponse } from 'next/server';
import { RESOURCES, ACTIONS } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as ArticleService from '@/lib/services/ArticleService';
import type { SoldInPeriod } from '@/lib/services/ArticleService';
import { createArticleSchema } from '@/lib/validations/schemas';
import { StockStatus } from '@/types/stockValuation';

const SOLD_IN_PERIODS: readonly SoldInPeriod[] = [
  'current-month',
  'last-month',
  'last-3-months',
  'last-6-months',
  'last-12-months',
];

const STOCK_STATUSES: readonly StockStatus[] = [
  StockStatus.ACTIVE,
  StockStatus.SLOW_MOVING,
  StockStatus.DEAD_STOCK,
  StockStatus.NEVER_SOLD,
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawSoldIn = searchParams.get('soldInPeriod');
    const soldInPeriod =
      rawSoldIn && (SOLD_IN_PERIODS as readonly string[]).includes(rawSoldIn)
        ? (rawSoldIn as SoldInPeriod)
        : undefined;
    const rawStatus = searchParams.get('stockStatus');
    const stockStatusFilter =
      rawStatus && (STOCK_STATUSES as readonly string[]).includes(rawStatus)
        ? (rawStatus as StockStatus)
        : undefined;
    const result = await ArticleService.list({
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
      search: searchParams.get('search') || '',
      categoryId: searchParams.get('categoryId') || undefined,
      isActive: searchParams.get('isActive') ?? undefined,
      includeABC: searchParams.get('includeABC') === 'true',
      abcFilter: searchParams.get('abcFilter') || undefined,
      salesSort: searchParams.get('salesSort') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortDescending: searchParams.get('sortDescending') === 'true',
      trendMonths: parseInt(searchParams.get('trendMonths') || '12'),
      lowStockOnly: searchParams.get('lowStockOnly') === 'true',
      hasStockOnly: searchParams.get('hasStockOnly') === 'true',
      zeroStockOnly: searchParams.get('zeroStockOnly') === 'true',
      ids: searchParams.get('ids') || undefined,
      codes: searchParams.get('codes') || undefined,
      includeTrends: searchParams.get('includeTrends') === 'true',
      soldInPeriod,
      stockStatusFilter,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requirePermission(request, RESOURCES.ARTICLES, ACTIONS.CREATE);
    if (!auth.authorized) return auth.error;

    const body = await request.json();
    const validatedData = createArticleSchema.parse(body);
    const article = await ArticleService.create(validatedData, request);
    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
