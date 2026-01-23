import { NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as DashboardService from '@/lib/services/DashboardService';

export async function GET() {
  try {
    const charts = await DashboardService.getCharts();
    return NextResponse.json(charts);
  } catch (error) {
    return handleError(error);
  }
}
