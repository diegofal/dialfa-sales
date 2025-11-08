/**
 * Dashboard Charts API
 * Fetches chart data from xERP SQL Server database
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeXerpQuery, executeSpisaQuery } from '@/lib/db/xerp';
import {
  XERP_TOP_CUSTOMERS,
  XERP_MONTHLY_SALES_TREND,
  SPISA_CASH_FLOW_HISTORY,
  TopCustomer,
  MonthlySalesTrend,
  CashFlowData,
} from '@/lib/db/xerpQueries';

/**
 * GET /api/dashboard/charts
 * Returns chart data for dashboard visualizations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '12', 10);

    // Execute all queries in parallel
    const [topCustomers, salesTrend, cashFlow] = await Promise.all([
      executeXerpQuery<TopCustomer>(XERP_TOP_CUSTOMERS),
      executeXerpQuery<MonthlySalesTrend>(XERP_MONTHLY_SALES_TREND),
      executeSpisaQuery<CashFlowData>(SPISA_CASH_FLOW_HISTORY),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        topCustomers: topCustomers || [],
        salesTrend: salesTrend || [],
        cashFlow: cashFlow || [],
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

