import { prisma } from '@/lib/db';
import { executeXerpScalar, executeXerpQuery } from '@/lib/db/xerp';
import {
  XERP_TOTAL_OUTSTANDING,
  XERP_TOTAL_OVERDUE,
  XERP_BILLED_MONTHLY,
  XERP_BILLED_TODAY,
  XERP_BILLED_PREV_MONTH,
  XERP_BILLED_SAME_MONTH_PREV_YEAR,
  XERP_TOP_CUSTOMERS,
  XERP_MONTHLY_SALES_TREND,
  DashboardMetrics,
  TopCustomer,
  MonthlySalesTrend,
} from '@/lib/db/xerpQueries';

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface TopCustomerByRevenue {
  clientId: number;
  businessName: string;
  revenueArs: number;
  invoiceCount: number;
}

export interface DashboardAlerts {
  stockoutsCount: number;
  lateProformasCount: number;
  pendingQuotesCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// Compute gross margin % from SPISA invoices for a date range.
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

function describeError(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return 'Error desconocido';
}

interface XerpScalars {
  totalOutstanding: number | null;
  totalOverdue: number | null;
  billedMonthly: number | null;
  billedToday: number | null;
  billedPrevMonth: number | null;
  billedSameMonthPrevYear: number | null;
}

async function fetchXerpScalars(): Promise<XerpScalars> {
  const [
    totalOutstanding,
    totalOverdue,
    billedMonthly,
    billedToday,
    billedPrevMonth,
    billedSameMonthPrevYear,
  ] = await Promise.all([
    executeXerpScalar<number>(XERP_TOTAL_OUTSTANDING),
    executeXerpScalar<number>(XERP_TOTAL_OVERDUE),
    executeXerpScalar<number>(XERP_BILLED_MONTHLY),
    executeXerpScalar<number>(XERP_BILLED_TODAY),
    executeXerpScalar<number>(XERP_BILLED_PREV_MONTH),
    executeXerpScalar<number>(XERP_BILLED_SAME_MONTH_PREV_YEAR),
  ]);
  return {
    totalOutstanding: totalOutstanding ?? 0,
    totalOverdue: totalOverdue ?? 0,
    billedMonthly: billedMonthly ?? 0,
    billedToday: billedToday ?? 0,
    billedPrevMonth: billedPrevMonth ?? 0,
    billedSameMonthPrevYear: billedSameMonthPrevYear ?? 0,
  };
}

interface MarginBlock {
  grossMarginPercent: number | null;
  grossMarginAmountArs: number | null;
  grossMarginPrevPercent: number | null;
}

async function fetchMarginBlock(usdRate: number): Promise<MarginBlock> {
  const monthRange = getCurrentMonthRange();
  const prevMonthRange = getPrevMonthRange();
  const [grossMarginPercent, grossMarginAmountArs, grossMarginPrevPercent] = await Promise.all([
    computeGrossMargin(monthRange.start, monthRange.end),
    computeGrossMarginAmountArs(monthRange.start, monthRange.end, usdRate),
    computeGrossMargin(prevMonthRange.start, prevMonthRange.end),
  ]);
  return { grossMarginPercent, grossMarginAmountArs, grossMarginPrevPercent };
}

export async function getMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const daysElapsed = now.getDate();

  const errors = { xerp: null as string | null, spisa: null as string | null };

  // xERP block: degrade gracefully if the legacy SQL Server is unreachable.
  let xerp: XerpScalars = {
    totalOutstanding: null,
    totalOverdue: null,
    billedMonthly: null,
    billedToday: null,
    billedPrevMonth: null,
    billedSameMonthPrevYear: null,
  };
  try {
    xerp = await fetchXerpScalars();
  } catch (e) {
    errors.xerp = describeError(e);
  }

  // SPISA block: margin requires PostgreSQL + system_settings.
  let usdRate = 1000;
  let margin: MarginBlock = {
    grossMarginPercent: null,
    grossMarginAmountArs: null,
    grossMarginPrevPercent: null,
  };
  try {
    usdRate = await getUsdExchangeRate();
    margin = await fetchMarginBlock(usdRate);
  } catch (e) {
    errors.spisa = describeError(e);
  }

  const dailyAverage =
    xerp.billedMonthly !== null && daysElapsed > 0 ? xerp.billedMonthly / daysElapsed : null;

  return {
    ...xerp,
    dailyAverageThisMonth: dailyAverage,
    daysElapsedThisMonth: daysElapsed,
    ...margin,
    errors,
  };
}

export interface DashboardChartsResponse {
  topCustomers: TopCustomer[];
  salesTrend: MonthlySalesTrend[];
  topCustomersByRevenue: TopCustomerByRevenue[];
  errors: { xerp: string | null; spisa: string | null };
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
  const errors = { xerp: null as string | null, spisa: null as string | null };

  let topCustomers: TopCustomer[] = [];
  let salesTrend: MonthlySalesTrend[] = [];
  try {
    const [tc, st] = await Promise.all([
      executeXerpQuery<TopCustomer>(XERP_TOP_CUSTOMERS),
      executeXerpQuery<MonthlySalesTrend>(XERP_MONTHLY_SALES_TREND),
    ]);
    topCustomers = tc ?? [];
    salesTrend = st ?? [];
  } catch (e) {
    errors.xerp = describeError(e);
  }

  let topCustomersByRevenue: TopCustomerByRevenue[] = [];
  try {
    topCustomersByRevenue = await fetchTopCustomersByRevenue();
  } catch (e) {
    errors.spisa = describeError(e);
  }

  return {
    topCustomers,
    salesTrend,
    topCustomersByRevenue,
    errors,
  };
}

export async function getOperationalMetrics(): Promise<OperationalMetrics> {
  const usdRate = await getUsdExchangeRate();

  // Stock valuation. last_purchase_price is USD FOB; CIF % brings it to landed cost.
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

  // Dead stock: stock > 0 AND (no sale ever OR last sale > 365 days ago)
  // Valued at retail (ARS) so the user sees "capital muerto a precio de venta"
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

  // Stockouts críticos: stock <= 0 AND has sale in last 180 days.
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

  // Pending to invoice: sales orders status PENDING and no active invoice.
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
  // Stockouts (already counted in operational; we expose here too for the alerts panel).
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

  // Late proformas: confirmed supplier orders past expected delivery, not yet received.
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

  // Pending quotes: sales orders in PENDING that haven't been touched in > 14 days.
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
