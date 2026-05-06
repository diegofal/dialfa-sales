import { NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as DashboardService from '@/lib/services/DashboardService';

export async function GET() {
  try {
    const data = await DashboardService.getTopArticlesSold();
    return NextResponse.json(data);
  } catch (error) {
    return handleError(error);
  }
}
