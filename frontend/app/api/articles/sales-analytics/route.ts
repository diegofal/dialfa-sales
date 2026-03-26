import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import { getSalesAnalytics } from '@/lib/services/SalesAnalyticsService';
import { SalesAnalyticsParams } from '@/types/salesAnalytics';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    const params: SalesAnalyticsParams = {
      periodMonths: parseInt(searchParams.get('periodMonths') || '12'),
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      categoryId: searchParams.get('categoryId')
        ? parseInt(searchParams.get('categoryId')!)
        : undefined,
    };

    const result = await getSalesAnalytics(params);
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
