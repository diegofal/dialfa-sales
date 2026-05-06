/**
 * DashboardService
 *
 * Sources of truth (must match dialfa-bi and SPISA's existing pages):
 *
 * - **xERP (Azure SQL)** — billed amounts and 12m sales trend, NET of credit notes
 *   (Type=10 minus Type=11). Mirrors dialfa-bi `XERP_BILLED_*` and
 *   `XERP_MONTHLY_SALES_TREND`.
 * - **SPISA Postgres `sync_*`** — outstanding/overdue (sync_balances), monthly
 *   collections + checks in portfolio (sync_transactions), top customers by AR.
 *   Mirrors dialfa-bi `EXECUTIVE_SUMMARY`, `SPISA_COLLECTED_MONTHLY`,
 *   `SPISA_FUTURE_PAYMENTS`, `TOP_CUSTOMERS`.
 * - **SPISA Postgres native** — stock valuation + dead stock via the canonical
 *   `calculateStockValuation()` (same that powers `/dashboard/articles/valuation`),
 *   margin via `invoice_items × articles`, top articles via
 *   `SalesAnalyticsService.getSalesAnalytics()`.
 */
import { prisma } from '@/lib/db';
import { executeXerpScalar, executeXerpQuery } from '@/lib/db/xerp';
import {
  XERP_BILLED_MONTHLY_NET,
  XERP_BILLED_TODAY_NET,
  XERP_BILLED_PREV_MONTH_NET,
  XERP_BILLED_SAME_MONTH_PREV_YEAR_NET,
  XERP_MONTHLY_SALES_TREND_NET,
  MonthlySalesTrend,
} from '@/lib/db/xerpQueries';
import { getSalesAnalytics } from '@/lib/services/SalesAnalyticsService';
import { calculateStockValuation } from '@/lib/utils/articles/stockValuation';
import { StockStatus } from '@/types/stockValuation';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardSourceErrors {
  xerp: string | null;
  spisa: string | null;
}

export interface ToCollectMonthly {
  total: number;
  cleared: number;
  pending: number;
  transactionCount: number;
}

export interface DashboardMetrics {
  // SPISA Postgres (sync_balances)
  totalOutstanding: number | null;
  totalOverdue: number | null;

  // xERP (NET of credit notes)
  billedMonthly: number | null;
  billedToday: number | null;
  billedPrevMonth: number | null;
  billedSameMonthPrevYear: number | null;
  dailyAverageThisMonth: number | null;
  daysElapsedThisMonth: number;

  // SPISA Postgres (sync_transactions) — payment side
  toCollectMonthly: ToCollectMonthly | null;
  checksInPortfolio: number | null;

  // SPISA invoice_items × articles
  grossMarginPercent: number | null;
  grossMarginAmountArs: number | null;
  grossMarginPrevPercent: number | null;

  errors: DashboardSourceErrors;
}

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TopCustomer {
  Name: string;
  OutstandingBalance: number;
  OverdueAmount: number;
  OverduePercentage: number;
  RiskLevel: RiskLevel;
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
  errors: DashboardSourceErrors;
}

export interface OperationalMetrics {
  stockValueCost: number;
  stockValueRetail: number;
  deadStockValue: number;
  deadStockArticleCount: number;
  stockoutsCriticalCount: number;
  error: string | null;
}

export interface TopArticleSold {
  articleId: number;
  code: string;
  description: string;
  unitsSold: number;
  revenueUsd: number;
  currentStock: number;
  status: StockStatus;
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

function classifyRisk(overduePercentage: number): RiskLevel {
  if (overduePercentage > 50) return 'HIGH';
  if (overduePercentage > 20) return 'MEDIUM';
  return 'LOW';
}

// Margin from SPISA invoices, USD-based. Margin = (revenue − cogs) / revenue.
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
  let toCollectMonthly: ToCollectMonthly | null = null;
  let checksInPortfolio: number | null = null;
  let grossMarginPercent: number | null = null;
  let grossMarginAmountArs: number | null = null;
  let grossMarginPrevPercent: number | null = null;
  const errors: DashboardSourceErrors = { xerp: null, spisa: null };

  // ─── xERP block ─────────────────────────────────────────────────────────────
  try {
    const [m, t, pm, sm] = await Promise.all([
      executeXerpScalar<number>(XERP_BILLED_MONTHLY_NET),
      executeXerpScalar<number>(XERP_BILLED_TODAY_NET),
      executeXerpScalar<number>(XERP_BILLED_PREV_MONTH_NET),
      executeXerpScalar<number>(XERP_BILLED_SAME_MONTH_PREV_YEAR_NET),
    ]);
    billedMonthly = m ?? 0;
    billedToday = t ?? 0;
    billedPrevMonth = pm ?? 0;
    billedSameMonthPrevYear = sm ?? 0;
  } catch (e) {
    errors.xerp = describeError(e);
  }

  // ─── SPISA block ────────────────────────────────────────────────────────────
  try {
    // Outstanding + overdue (sync_balances), mirrors BI EXECUTIVE_SUMMARY.
    const balancesQuery = prisma.$queryRawUnsafe<
      Array<{ total_outstanding: number | null; total_overdue: number | null }>
    >(
      `SELECT
        COALESCE(SUM(amount), 0) as total_outstanding,
        COALESCE(SUM(due), 0) as total_overdue
      FROM sync_balances
      WHERE amount > 100`
    );

    // To collect this month — mirrors BI SPISA_COLLECTED_MONTHLY.
    const toCollectQuery = prisma.$queryRawUnsafe<
      Array<{
        total: number | null;
        cleared: number | null;
        pending: number | null;
        transaction_count: number | null;
      }>
    >(
      `SELECT
        COALESCE(SUM(payment_amount), 0) as total,
        COALESCE(SUM(CASE WHEN payment_date <= NOW() THEN payment_amount ELSE 0 END), 0) as cleared,
        COALESCE(SUM(CASE WHEN payment_date > NOW() THEN payment_amount ELSE 0 END), 0) as pending,
        COUNT(*) as transaction_count
      FROM sync_transactions
      WHERE EXTRACT(MONTH FROM payment_date)::int = EXTRACT(MONTH FROM NOW())::int
        AND EXTRACT(YEAR FROM payment_date)::int = EXTRACT(YEAR FROM NOW())::int
        AND payment_date IS NOT NULL
        AND payment_date > '2020-01-01'
        AND payment_amount > 0`
    );

    // Checks in portfolio — mirrors BI SPISA_FUTURE_PAYMENTS.
    const checksQuery = prisma.$queryRawUnsafe<Array<{ amount: number | null }>>(
      `SELECT COALESCE(SUM(payment_amount), 0) as amount
      FROM sync_transactions
      WHERE type = 0
        AND payment_amount <> 0
        AND payment_date >= NOW()`
    );

    const monthRange = getCurrentMonthRange();
    const prevMonthRange = getPrevMonthRange();
    const usdRatePromise = getUsdExchangeRate();
    const marginThisMonthPromise = computeGrossMargin(monthRange.start, monthRange.end);
    const marginPrevMonthPromise = computeGrossMargin(prevMonthRange.start, prevMonthRange.end);

    const [balances, collectRows, checksRows, usdRate, mPercent, mPrev] = await Promise.all([
      balancesQuery,
      toCollectQuery,
      checksQuery,
      usdRatePromise,
      marginThisMonthPromise,
      marginPrevMonthPromise,
    ]);

    totalOutstanding = Number(balances[0]?.total_outstanding || 0);
    totalOverdue = Number(balances[0]?.total_overdue || 0);
    toCollectMonthly = {
      total: Number(collectRows[0]?.total || 0),
      cleared: Number(collectRows[0]?.cleared || 0),
      pending: Number(collectRows[0]?.pending || 0),
      transactionCount: Number(collectRows[0]?.transaction_count || 0),
    };
    checksInPortfolio = Number(checksRows[0]?.amount || 0);
    grossMarginPercent = mPercent;
    grossMarginPrevPercent = mPrev;
    grossMarginAmountArs = await computeGrossMarginAmountArs(
      monthRange.start,
      monthRange.end,
      usdRate
    );
  } catch (e) {
    errors.spisa = describeError(e);
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
    toCollectMonthly,
    checksInPortfolio,
    grossMarginPercent,
    grossMarginAmountArs,
    grossMarginPrevPercent,
    errors,
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

async function fetchTopCustomersByBalance(): Promise<TopCustomer[]> {
  const rows = await prisma.$queryRawUnsafe<
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
  return rows.map((row) => {
    const balance = Number(row.outstanding_balance || 0);
    const overdue = Number(row.overdue_amount || 0);
    const overduePct = balance > 0 ? (overdue / balance) * 100 : 0;
    return {
      Name: row.name,
      OutstandingBalance: balance,
      OverdueAmount: overdue,
      OverduePercentage: overduePct,
      RiskLevel: classifyRisk(overduePct),
    };
  });
}

export async function getCharts(): Promise<DashboardChartsResponse> {
  let topCustomers: TopCustomer[] = [];
  let salesTrend: MonthlySalesTrend[] = [];
  let topCustomersByRevenue: TopCustomerByRevenue[] = [];
  const errors: DashboardSourceErrors = { xerp: null, spisa: null };

  // xERP-side: 12-month sales trend (NET of credit notes).
  try {
    const trend = await executeXerpQuery<MonthlySalesTrend>(XERP_MONTHLY_SALES_TREND_NET);
    salesTrend = trend ?? [];
  } catch (e) {
    errors.xerp = describeError(e);
  }

  // SPISA-side: top customers by AR + by current-month revenue.
  try {
    const [byBalance, byRevenue] = await Promise.all([
      fetchTopCustomersByBalance(),
      fetchTopCustomersByRevenue(),
    ]);
    topCustomers = byBalance;
    topCustomersByRevenue = byRevenue;
  } catch (e) {
    errors.spisa = describeError(e);
  }

  return { topCustomers, salesTrend, topCustomersByRevenue, errors };
}

export async function getOperationalMetrics(): Promise<OperationalMetrics> {
  let stockValueCost = 0;
  let stockValueRetail = 0;
  let deadStockValue = 0;
  let deadStockArticleCount = 0;
  let stockoutsCriticalCount = 0;
  let error: string | null = null;

  try {
    // Reuse the canonical valuation. Same numbers as /dashboard/articles/valuation.
    const valuation = await calculateStockValuation({ includeZeroStock: false });
    stockValueCost = valuation.totals.totalStockValue;
    stockValueRetail = valuation.totals.totalValueAtListPrice;

    const dead = valuation.byStatus[StockStatus.DEAD_STOCK];
    const never = valuation.byStatus[StockStatus.NEVER_SOLD];
    deadStockValue = dead.totalValue + never.totalValue;
    deadStockArticleCount = dead.count + never.count;

    // Stockouts con demanda: stock <= 0 and sold in last 180 days. Matches the
    // Python script (scripts/stock_rotation_spisa.py "stockouts críticos").
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
    stockoutsCriticalCount = Number(stockoutRows[0]?.count || 0);
  } catch (e) {
    error = describeError(e);
  }

  return {
    stockValueCost,
    stockValueRetail,
    deadStockValue,
    deadStockArticleCount,
    stockoutsCriticalCount,
    error,
  };
}

export async function getTopArticlesSold(): Promise<{
  articles: TopArticleSold[];
  error: string | null;
}> {
  try {
    const monthRange = getCurrentMonthRange();
    const analytics = await getSalesAnalytics({
      periodMonths: 1,
      startDate: monthRange.start.toISOString(),
      endDate: monthRange.end.toISOString(),
    });

    if (analytics.topArticles.length === 0) {
      return { articles: [], error: null };
    }

    // Enrich each top article with current stock and canonical status.
    // Use the same valuation cache so the status badge matches the valuation page.
    const valuation = await calculateStockValuation({ includeZeroStock: true });
    const byId = new Map<number, { currentStock: number; status: StockStatus }>();
    for (const status of Object.values(StockStatus)) {
      for (const a of valuation.byStatus[status].articles) {
        byId.set(Number(a.articleId), {
          currentStock: a.currentStock,
          status: a.status,
        });
      }
    }

    const articles: TopArticleSold[] = analytics.topArticles.slice(0, 10).map((a) => {
      const enrichment = byId.get(a.articleId);
      return {
        articleId: a.articleId,
        code: a.code,
        description: a.description,
        unitsSold: a.units,
        revenueUsd: a.revenue,
        currentStock: enrichment?.currentStock ?? 0,
        status: enrichment?.status ?? StockStatus.NEVER_SOLD,
      };
    });

    return { articles, error: null };
  } catch (e) {
    return { articles: [], error: describeError(e) };
  }
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
