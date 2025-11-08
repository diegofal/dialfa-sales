/**
 * Dashboard Metrics API
 * Fetches BI metrics from xERP SQL Server database
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeXerpScalar } from '@/lib/db/xerp';
import {
  XERP_TOTAL_OUTSTANDING,
  XERP_TOTAL_OVERDUE,
  XERP_BILLED_MONTHLY,
  XERP_BILLED_TODAY,
  DashboardMetrics,
} from '@/lib/db/xerpQueries';

/**
 * GET /api/dashboard/metrics
 * Returns all dashboard metrics for the BI cards
 */
export async function GET(request: NextRequest) {
  try {
    // Execute all queries in parallel for better performance
    const [
      totalOutstanding,
      totalOverdue,
      billedMonthly,
      billedToday,
    ] = await Promise.all([
      executeXerpScalar<number>(XERP_TOTAL_OUTSTANDING),
      executeXerpScalar<number>(XERP_TOTAL_OVERDUE),
      executeXerpScalar<number>(XERP_BILLED_MONTHLY),
      executeXerpScalar<number>(XERP_BILLED_TODAY),
    ]);

    const metrics: DashboardMetrics = {
      totalOutstanding: totalOutstanding || 0,
      totalOverdue: totalOverdue || 0,
      billedMonthly: billedMonthly || 0,
      billedToday: billedToday || 0,
    };

    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

