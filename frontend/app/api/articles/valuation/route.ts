import { NextRequest, NextResponse } from 'next/server';
import { RESOURCES, ACTIONS } from '@/lib/auth/permissions';
import { getUserFromRequest, requirePermission } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as ArticleService from '@/lib/services/ArticleService';
import { StockStatus } from '@/types/stockValuation';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const config = {
      activeThresholdDays: parseInt(searchParams.get('activeThreshold') || '90'),
      slowMovingThresholdDays: parseInt(searchParams.get('slowThreshold') || '180'),
      deadStockThresholdDays: parseInt(searchParams.get('deadThreshold') || '365'),
      minSalesForActive: parseInt(searchParams.get('minSales') || '5'),
      trendMonths: parseInt(searchParams.get('trendMonths') || '6'),
      includeZeroStock: searchParams.get('includeZeroStock') === 'true',
    };

    const forceRefresh = searchParams.get('refresh') === 'true';
    const statusFilter = searchParams.get('status') as StockStatus | undefined;

    const result = await ArticleService.getValuation(
      config,
      forceRefresh,
      statusFilter || undefined
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requirePermission(request, RESOURCES.ARTICLES, ACTIONS.VALUATION);
    if (!auth.authorized) return auth.error;

    const body = await request.json();
    const result = await ArticleService.getValuation(body.config || {}, true);
    return NextResponse.json({
      message: 'Valorización recalculada exitosamente',
      valuation: result,
    });
  } catch (error) {
    return handleError(error);
  }
}
