import { NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as DashboardService from '@/lib/services/DashboardService';

export async function GET() {
  try {
    const alerts = await DashboardService.getAlerts();
    return NextResponse.json(alerts);
  } catch (error) {
    return handleError(error);
  }
}
