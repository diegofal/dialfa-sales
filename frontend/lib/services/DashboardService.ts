/**
 * DashboardService
 *
 * All commercial KPIs (billed, outstanding, overdue, top customers, sales trend)
 * read from Postgres sync_* tables, which mirror xERP data via the customer-sync
 * pipeline. This matches the dialfa-bi dashboard one-for-one and removes the
 * Azure SQL firewall dependency at runtime.
 *
 * Margin uses native SPISA invoice_items + articles (USD-based, with CIF %).
 *
 * Operational metrics and alerts read native SPISA tables (articles, sales_orders,
 * supplier_orders, stock_movements).
 */
import { prisma } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  totalOutstanding: number | null;
  totalOverdue: number | null;
  billedMonthly: number | null;
  billedToday: number | null;
  billedPrevMonth: number | null;
  billedSameMonthPrevYear: number | null;
  dailyAverageThisMonth: number | null;
  daysElapsedThisMonth: number;
  grossMarginPercent: number | null;
  grossMarginAmountArs: number | null;
  grossMarginPrevPercent: number | null;
  error: string | null;
}

export interface TopCustomer {
  Name: string;
  OutstandingBalance: number;
  OverdueAmount: number;
  OverduePercentage: number;
}

export interface MonthlySalesTrend {
  Year: number;
  Month: number;
  MonthName: string;
  MonthlyRevenue: number;
  InvoiceCount: number;
  UniqueCustomers: number;
}

export interface TopCustomerByRevenue {
  clientId: number;
  businessName: string;
  revenueArs: number;
  invoiceCount: number;
}

export interface DashboardChartsResponse {
  topCustomers: TopCustomer[];
  salesTrend: MonthlySalesTrend[];
  topCustomersByRevenue: TopCustomerByRevenue[];
  error: string | null;
}

export interface OperationalMetrics {
  stockValueCostUsd: number;
  stockValueCostArs: number;
  stockValueRetailArs: number;
  deadStockValueArs: number;
  deadStockArticleCount: number;
  stockoutsCriticalCount: number;
  pendingToInvoiceCount: number;
  pendingToInvoiceArs: number;
  usdExchangeRate: number;
}

export interface DashboardAlerts {
  stockoutsCount: number;
  lateProformasCount: number;
  pendingQuotesCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function describeError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return 'Error desconocido';
}

function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

function getPrevMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end };
}

async function getUsdExchangeRate(): Promise<number> {
  const setting = await prisma.system_settings.findFirst();
  const value = setting?.usd_exchange_rate ? Number(setting.usd_exchange_rate) : 0;
  return value > 0 ? value : 1000;
}

// Margin from SPISA invoices for a date range.
// Margin = (revenue_usd - cogs_usd) / revenue_usd
// COGS_usd = qty × last_purchase_price × (1 + cif_pct/100)
async function computeGrossMargin(start: Date, end: Date): Promise<number | null> {
  const result = await prisma.$queryRawUnsafe<
    Array<{ revenue_usd: number | null; cogs_usd: number | null }>
  >(
    `SELECT
      COALESCE(SUM(ii.unit_price_usd * ii.quantity * (1 - ii.discount_percent / 100)), 0) as revenue_usd,
      COALESCE(SUM(
        ii.quantity * COALESCE(a.last_purchase_price, 0) * (1 + COALESCE(a.cif_percentage, 50) / 100)
      ), 0) as cogs_usd
    FROM invoice_items ii
    INNER JOIN invoices i ON ii.invoice_id = i.id
    INNER JOIN articles a ON ii.article_id = a.id
    WHERE i.is_printed = true
      AND i.is_cancelled = false
      AND i.deleted_at IS NULL
      AND i.invoice_date >= $1
      AND i.invoice_date < $2`,
    start,
    end
  );
  const row = result[0];
  const revenue = Number(row?.revenue_usd || 0);
  const cogs = Number(row?.cogs_usd || 0);
  if (revenue <= 0) return null;
  return ((revenue - cogs) / revenue) * 100;
}

async function computeGrossMarginAmountArs(
  start: Date,
  end: Date,
  usdRate: number
): Promise<number | null> {
  const result = await prisma.$queryRawUnsafe<
    Array<{ revenue_usd: number | null; cogs_usd: number | null }>
  >(
    `SELECT
      COALESCE(SUM(ii.unit_price_usd * ii.quantity * (1 - ii.discount_percent / 100)), 0) as revenue_usd,
      COALESCE(SUM(
        ii.quantity * COALESCE(a.last_purchase_price, 0) * (1 + COALESCE(a.cif_percentage, 50) / 100)
      ), 0) as cogs_usd
    FROM invoice_items ii
    INNER JOIN invoices i ON ii.invoice_id = i.id
    INNER JOIN articles a ON ii.article_id = a.id
    WHERE i.is_printed = true
      AND i.is_cancelled = false
      AND i.deleted_at IS NULL
      AND i.invoice_date >= $1
      AND i.invoice_date < $2`,
    start,
    end
  );
  const row = result[0];
  const revenue = Number(row?.revenue_usd || 0);
  const cogs = Number(row?.cogs_usd || 0);
  if (revenue <= 0) return null;
  return (revenue - cogs) * usdRate;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function getMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const daysElapsed = now.getDate();

  let totalOutstanding: number | null = null;
  let totalOverdue: number | null = null;
  let billedMonthly: number | null = null;
  let billedToday: number | null = null;
  let billedPrevMonth: number | null = null;
  let billedSameMonthPrevYear: number | null = null;
  let grossMarginPercent: number | null = null;
  let grossMarginAmountArs: number | null = null;
  let grossMarginPrevPercent: number | null = null;
  let error: string | null = null;

  try {
    // sync_balances: AR snapshot synced from xERP. amount = current outstanding (net),
    // due = overdue portion. Filter `amount > 100` to exclude rounding noise (mirrors BI).
    const balancesQuery = prisma.$queryRawUnsafe<
      Array<{ total_outstanding: number | null; total_overdue: number | null }>
    >(
      `SELECT
        COALESCE(SUM(amount), 0) as total_outstanding,
        COALESCE(SUM(due), 0) as total_overdue
      FROM sync_balances
      WHERE amount > 100`
    );

    // sync_transactions: invoice rows live with type=1 (mirrors BI's BILLED queries).
    const billedMonthlyQuery = prisma.$queryRawUnsafe<Array<{ amount: number | null }>>(
      `SELECT COALESCE(SUM(invoice_amount), 0) as amount
      FROM sync_transactions
      WHERE type = 1
        AND EXTRACT(MONTH FROM invoice_date)::int = EXTRACT(MONTH FROM NOW())::int
        AND EXTRACT(YEAR FROM invoice_date)::int = EXTRACT(YEAR FROM NOW())::int`
    );

    const billedTodayQuery = prisma.$queryRawUnsafe<Array<{ amount: number | null }>>(
      `SELECT COALESCE(SUM(invoice_amount), 0) as amount
      FROM sync_transactions
      WHERE type = 1
        AND invoice_date::date = NOW()::date`
    );

    const billedPrevMonthQuery = prisma.$queryRawUnsafe<Array<{ amount: number | null }>>(
      `SELECT COALESCE(SUM(invoice_amount), 0) as amount
      FROM sync_transactions
      WHERE type = 1
        AND EXTRACT(MONTH FROM invoice_date)::int = EXTRACT(MONTH FROM (NOW() - INTERVAL '1 month'))::int
        AND EXTRACT(YEAR FROM invoice_date)::int = EXTRACT(YEAR FROM (NOW() - INTERVAL '1 month'))::int`
    );

    const billedSameMonthPrevYearQuery = prisma.$queryRawUnsafe<Array<{ amount: number | null }>>(
      `SELECT COALESCE(SUM(invoice_amount), 0) as amount
      FROM sync_transactions
      WHERE type = 1
        AND EXTRACT(MONTH FROM invoice_date)::int = EXTRACT(MONTH FROM NOW())::int
        AND EXTRACT(YEAR FROM invoice_date)::int = EXTRACT(YEAR FROM NOW())::int - 1`
    );

    const monthRange = getCurrentMonthRange();
    const prevMonthRange = getPrevMonthRange();

    const usdRatePromise = getUsdExchangeRate();
    const marginThisMonthPromise = computeGrossMargin(monthRange.start, monthRange.end);
    const marginPrevMonthPromise = computeGrossMargin(prevMonthRange.start, prevMonthRange.end);

    const [
      balancesRows,
      billedMonthlyRows,
      billedTodayRows,
      billedPrevMonthRows,
      billedSameMonthPrevYearRows,
      usdRate,
      mPercent,
      mPrev,
    ] = await Promise.all([
      balancesQuery,
      billedMonthlyQuery,
      billedTodayQuery,
      billedPrevMonthQuery,
      billedSameMonthPrevYearQuery,
      usdRatePromise,
      marginThisMonthPromise,
      marginPrevMonthPromise,
    ]);

    totalOutstanding = Number(balancesRows[0]?.total_outstanding || 0);
    totalOverdue = Number(balancesRows[0]?.total_overdue || 0);
    billedMonthly = Number(billedMonthlyRows[0]?.amount || 0);
    billedToday = Number(billedTodayRows[0]?.amount || 0);
    billedPrevMonth = Number(billedPrevMonthRows[0]?.amount || 0);
    billedSameMonthPrevYear = Number(billedSameMonthPrevYearRows[0]?.amount || 0);
    grossMarginPercent = mPercent;
    grossMarginPrevPercent = mPrev;
    grossMarginAmountArs = await computeGrossMarginAmountArs(
      monthRange.start,
      monthRange.end,
      usdRate
    );
  } catch (e) {
    error = describeError(e);
  }

  const dailyAverage =
    billedMonthly !== null && daysElapsed > 0 ? billedMonthly / daysElapsed : null;

  return {
    totalOutstanding,
    totalOverdue,
    billedMonthly,
    billedToday,
    billedPrevMonth,
    billedSameMonthPrevYear,
    dailyAverageThisMonth: dailyAverage,
    daysElapsedThisMonth: daysElapsed,
    grossMarginPercent,
    grossMarginAmountArs,
    grossMarginPrevPercent,
    error,
  };
}

async function fetchTopCustomersByRevenue(): Promise<TopCustomerByRevenue[]> {
  const monthRange = getCurrentMonthRange();
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      client_id: bigint;
      business_name: string;
      revenue_ars: number | null;
      invoice_count: number | null;
    }>
  >(
    `SELECT
      c.id as client_id,
      c.business_name,
      COALESCE(SUM(i.total_amount), 0) as revenue_ars,
      COUNT(DISTINCT i.id) as invoice_count
    FROM invoices i
    INNER JOIN sales_orders so ON i.sales_order_id = so.id
    INNER JOIN clients c ON so.client_id = c.id
    WHERE i.is_printed = true
      AND i.is_cancelled = false
      AND i.deleted_at IS NULL
      AND i.invoice_date >= $1
      AND i.invoice_date < $2
    GROUP BY c.id, c.business_name
    HAVING COALESCE(SUM(i.total_amount), 0) > 0
    ORDER BY revenue_ars DESC
    LIMIT 10`,
    monthRange.start,
    monthRange.end
  );
  return rows.map((row) => ({
    clientId: Number(row.client_id),
    businessName: row.business_name,
    revenueArs: Number(row.revenue_ars || 0),
    invoiceCount: Number(row.invoice_count || 0),
  }));
}

export async function getCharts(): Promise<DashboardChartsResponse> {
  let topCustomers: TopCustomer[] = [];
  let salesTrend: MonthlySalesTrend[] = [];
  let topCustomersByRevenue: TopCustomerByRevenue[] = [];
  let error: string | null = null;

  try {
    // Top 10 customers by AR balance — from sync_*, mirrors dialfa-bi.
    const topCustomersQuery = prisma.$queryRawUnsafe<
      Array<{
        name: string;
        outstanding_balance: number | null;
        overdue_amount: number | null;
      }>
    >(
      `SELECT
        c.name as name,
        b.amount as outstanding_balance,
        b.due as overdue_amount
      FROM sync_customers c
      INNER JOIN sync_balances b ON c.id = b.customer_id
      WHERE b.amount > 100
      ORDER BY b.amount DESC
      LIMIT 10`
    );

    // 12-month invoice trend grouped by year-month — from sync_transactions.
    const salesTrendQuery = prisma.$queryRawUnsafe<
      Array<{
        year: number;
        month: number;
        month_name: string;
        monthly_revenue: number | null;
        invoice_count: number | null;
        unique_customers: number | null;
      }>
    >(
      `SELECT
        EXTRACT(YEAR FROM invoice_date)::int as year,
        EXTRACT(MONTH FROM invoice_date)::int as month,
        TRIM(TO_CHAR(invoice_date, 'Month')) as month_name,
        COALESCE(SUM(invoice_amount), 0) as monthly_revenue,
        COUNT(*) as invoice_count,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM sync_transactions
      WHERE type = 1
        AND invoice_date >= NOW() - INTERVAL '12 months'
      GROUP BY EXTRACT(YEAR FROM invoice_date)::int, EXTRACT(MONTH FROM invoice_date)::int, TRIM(TO_CHAR(invoice_date, 'Month'))
      ORDER BY year DESC, month DESC`
    );

    const [topRows, trendRows, byRevenue] = await Promise.all([
      topCustomersQuery,
      salesTrendQuery,
      fetchTopCustomersByRevenue(),
    ]);

    topCustomers = topRows.map((row) => {
      const balance = Number(row.outstanding_balance || 0);
      const overdue = Number(row.overdue_amount || 0);
      return {
        Name: row.name,
        OutstandingBalance: balance,
        OverdueAmount: overdue,
        OverduePercentage: balance > 0 ? (overdue / balance) * 100 : 0,
      };
    });

    salesTrend = trendRows.map((row) => ({
      Year: Number(row.year),
      Month: Number(row.month),
      MonthName: row.month_name,
      MonthlyRevenue: Number(row.monthly_revenue || 0),
      InvoiceCount: Number(row.invoice_count || 0),
      UniqueCustomers: Number(row.unique_customers || 0),
    }));

    topCustomersByRevenue = byRevenue;
  } catch (e) {
    error = describeError(e);
  }

  return { topCustomers, salesTrend, topCustomersByRevenue, error };
}

export async function getOperationalMetrics(): Promise<OperationalMetrics> {
  const usdRate = await getUsdExchangeRate();

  const stockValueRows = await prisma.$queryRawUnsafe<
    Array<{
      cost_usd: number | null;
      retail_ars: number | null;
    }>
  >(
    `SELECT
      COALESCE(SUM(
        a.stock * COALESCE(a.last_purchase_price, 0) * (1 + COALESCE(a.cif_percentage, 50) / 100)
      ), 0) as cost_usd,
      COALESCE(SUM(a.stock * a.unit_price), 0) as retail_ars
    FROM articles a
    WHERE a.deleted_at IS NULL
      AND a.is_active = true
      AND a.is_discontinued = false
      AND a.stock > 0`
  );
  const stockValueCostUsd = Number(stockValueRows[0]?.cost_usd || 0);
  const stockValueRetailArs = Number(stockValueRows[0]?.retail_ars || 0);
  const stockValueCostArs = stockValueCostUsd * usdRate;

  const deadStockRows = await prisma.$queryRawUnsafe<
    Array<{ value_ars: number | null; article_count: number | null }>
  >(
    `SELECT
      COALESCE(SUM(a.stock * a.unit_price), 0) as value_ars,
      COUNT(*) as article_count
    FROM articles a
    LEFT JOIN (
      SELECT article_id, MAX(movement_date) as last_sale
      FROM stock_movements
      WHERE movement_type = 2
        AND deleted_at IS NULL
      GROUP BY article_id
    ) lm ON lm.article_id = a.id
    WHERE a.deleted_at IS NULL
      AND a.is_active = true
      AND a.is_discontinued = false
      AND a.stock > 0
      AND (lm.last_sale IS NULL OR lm.last_sale < NOW() - INTERVAL '365 days')`
  );
  const deadStockValueArs = Number(deadStockRows[0]?.value_ars || 0);
  const deadStockArticleCount = Number(deadStockRows[0]?.article_count || 0);

  const stockoutRows = await prisma.$queryRawUnsafe<Array<{ count: number | null }>>(
    `SELECT COUNT(*) as count
    FROM articles a
    WHERE a.deleted_at IS NULL
      AND a.is_active = true
      AND a.is_discontinued = false
      AND a.stock <= 0
      AND EXISTS (
        SELECT 1 FROM stock_movements sm
        WHERE sm.article_id = a.id
          AND sm.movement_type = 2
          AND sm.deleted_at IS NULL
          AND sm.movement_date >= NOW() - INTERVAL '180 days'
      )`
  );
  const stockoutsCriticalCount = Number(stockoutRows[0]?.count || 0);

  const pendingRows = await prisma.$queryRawUnsafe<
    Array<{ count: number | null; total_ars: number | null }>
  >(
    `SELECT
      COUNT(*) as count,
      COALESCE(SUM(so.total), 0) as total_ars
    FROM sales_orders so
    WHERE so.deleted_at IS NULL
      AND so.status = 'PENDING'
      AND NOT EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.sales_order_id = so.id
          AND i.is_cancelled = false
          AND i.deleted_at IS NULL
      )`
  );
  const pendingToInvoiceCount = Number(pendingRows[0]?.count || 0);
  const pendingToInvoiceArs = Number(pendingRows[0]?.total_ars || 0);

  return {
    stockValueCostUsd,
    stockValueCostArs,
    stockValueRetailArs,
    deadStockValueArs,
    deadStockArticleCount,
    stockoutsCriticalCount,
    pendingToInvoiceCount,
    pendingToInvoiceArs,
    usdExchangeRate: usdRate,
  };
}

export async function getAlerts(): Promise<DashboardAlerts> {
  const stockoutRows = await prisma.$queryRawUnsafe<Array<{ count: number | null }>>(
    `SELECT COUNT(*) as count
    FROM articles a
    WHERE a.deleted_at IS NULL
      AND a.is_active = true
      AND a.is_discontinued = false
      AND a.stock <= 0
      AND EXISTS (
        SELECT 1 FROM stock_movements sm
        WHERE sm.article_id = a.id
          AND sm.movement_type = 2
          AND sm.deleted_at IS NULL
          AND sm.movement_date >= NOW() - INTERVAL '180 days'
      )`
  );
  const stockoutsCount = Number(stockoutRows[0]?.count || 0);

  const lateProformaRows = await prisma.$queryRawUnsafe<Array<{ count: number | null }>>(
    `SELECT COUNT(*) as count
    FROM supplier_orders so
    WHERE so.deleted_at IS NULL
      AND so.status = 'confirmed'
      AND so.expected_delivery_date IS NOT NULL
      AND so.expected_delivery_date < NOW()
      AND so.actual_delivery_date IS NULL`
  );
  const lateProformasCount = Number(lateProformaRows[0]?.count || 0);

  const pendingQuotesRows = await prisma.$queryRawUnsafe<Array<{ count: number | null }>>(
    `SELECT COUNT(*) as count
    FROM sales_orders so
    WHERE so.deleted_at IS NULL
      AND so.status = 'PENDING'
      AND so.updated_at < NOW() - INTERVAL '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.sales_order_id = so.id
          AND i.is_cancelled = false
          AND i.deleted_at IS NULL
      )`
  );
  const pendingQuotesCount = Number(pendingQuotesRows[0]?.count || 0);

  return {
    stockoutsCount,
    lateProformasCount,
    pendingQuotesCount,
  };
}
