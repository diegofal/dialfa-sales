import { NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as DashboardService from '@/lib/services/DashboardService';

export async function GET() {
  try {
    const metrics = await DashboardService.getMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    return handleError(error);
  }
}
