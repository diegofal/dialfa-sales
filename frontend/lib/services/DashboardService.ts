import { executeXerpScalar, executeXerpQuery } from '@/lib/db/xerp';
import {
  XERP_TOTAL_OUTSTANDING,
  XERP_TOTAL_OVERDUE,
  XERP_BILLED_MONTHLY,
  XERP_BILLED_TODAY,
  XERP_TOP_CUSTOMERS,
  XERP_MONTHLY_SALES_TREND,
  DashboardMetrics,
  TopCustomer,
  MonthlySalesTrend,
} from '@/lib/db/xerpQueries';

// ─── Service ──────────────────────────────────────────────────────────────────

export async function getMetrics(): Promise<DashboardMetrics> {
  const [totalOutstanding, totalOverdue, billedMonthly, billedToday] = await Promise.all([
    executeXerpScalar<number>(XERP_TOTAL_OUTSTANDING),
    executeXerpScalar<number>(XERP_TOTAL_OVERDUE),
    executeXerpScalar<number>(XERP_BILLED_MONTHLY),
    executeXerpScalar<number>(XERP_BILLED_TODAY),
  ]);

  return {
    totalOutstanding: totalOutstanding || 0,
    totalOverdue: totalOverdue || 0,
    billedMonthly: billedMonthly || 0,
    billedToday: billedToday || 0,
  };
}

export async function getCharts(): Promise<{
  topCustomers: TopCustomer[];
  salesTrend: MonthlySalesTrend[];
}> {
  const [topCustomers, salesTrend] = await Promise.all([
    executeXerpQuery<TopCustomer>(XERP_TOP_CUSTOMERS),
    executeXerpQuery<MonthlySalesTrend>(XERP_MONTHLY_SALES_TREND),
  ]);

  return {
    topCustomers: topCustomers || [],
    salesTrend: salesTrend || [],
  };
}
