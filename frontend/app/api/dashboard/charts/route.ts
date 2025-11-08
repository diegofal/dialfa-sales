/**
 * Dashboard Charts API
 * Fetches chart data from xERP SQL Server database
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeXerpQuery } from '@/lib/db/xerp';
import {
  XERP_TOP_CUSTOMERS,
  XERP_MONTHLY_SALES_TREND,
  TopCustomer,
  MonthlySalesTrend,
} from '@/lib/db/xerpQueries';

/**
 * GET /api/dashboard/charts
 * Returns chart data for dashboard visualizations
 */
export async function GET() {
  try {
    // Execute all queries in parallel
    const [topCustomers, salesTrend] = await Promise.all([
      executeXerpQuery<TopCustomer>(XERP_TOP_CUSTOMERS),
      executeXerpQuery<MonthlySalesTrend>(XERP_MONTHLY_SALES_TREND),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        topCustomers: topCustomers || [],
        salesTrend: salesTrend || [],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Dashboard charts error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dashboard charts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

