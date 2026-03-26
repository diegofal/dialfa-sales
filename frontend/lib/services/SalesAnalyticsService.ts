import { prisma } from '@/lib/db';
import {
  SalesAnalyticsParams,
  SalesAnalyticsResponse,
  SalesKPIs,
  RevenueByMonth,
  SalesByCategory,
  TopArticle,
  StockEvolutionPoint,
} from '@/types/salesAnalytics';

// Cache en memoria
const analyticsCache: {
  data: Map<string, SalesAnalyticsResponse>;
  timestamps: Map<string, number>;
} = {
  data: new Map(),
  timestamps: new Map(),
};

const CACHE_DURATION = 60 * 60 * 1000; // 1 hora

function getCacheKey(params: SalesAnalyticsParams): string {
  return `${params.periodMonths}-${params.startDate || ''}-${params.endDate || ''}-${params.categoryId || ''}`;
}

function getDateRange(params: SalesAnalyticsParams): { startDate: Date; endDate: Date } {
  const endDate = params.endDate ? new Date(params.endDate) : new Date();
  let startDate: Date;

  if (params.startDate) {
    startDate = new Date(params.startDate);
  } else {
    startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - params.periodMonths);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

// Revenue in USD: unit_price_usd * quantity * (1 - discount_percent/100)
const REVENUE_USD_EXPR = `(ii.unit_price_usd * ii.quantity * (1 - ii.discount_percent / 100))`;

async function getKPIs(startDate: Date, endDate: Date, categoryId?: number): Promise<SalesKPIs> {
  const categoryCondition = categoryId ? `AND a.category_id = ${categoryId}` : '';

  const result = await prisma.$queryRawUnsafe<
    Array<{
      total_revenue: number | null;
      total_units: number | null;
      invoice_count: number | null;
      unique_articles: number | null;
    }>
  >(
    `SELECT
      COALESCE(SUM(${REVENUE_USD_EXPR}), 0) as total_revenue,
      COALESCE(SUM(ii.quantity), 0) as total_units,
      COUNT(DISTINCT ii.invoice_id) as invoice_count,
      COUNT(DISTINCT ii.article_id) as unique_articles
    FROM invoice_items ii
    INNER JOIN invoices i ON ii.invoice_id = i.id
    INNER JOIN articles a ON ii.article_id = a.id
    WHERE i.is_printed = true
      AND i.is_cancelled = false
      AND i.deleted_at IS NULL
      AND i.invoice_date >= $1
      AND i.invoice_date <= $2
      ${categoryCondition}`,
    startDate,
    endDate
  );

  const row = result[0];
  const totalRevenue = Number(row?.total_revenue || 0);
  const invoiceCount = Number(row?.invoice_count || 0);

  return {
    totalRevenue,
    totalUnits: Number(row?.total_units || 0),
    avgOrderValue: invoiceCount > 0 ? totalRevenue / invoiceCount : 0,
    uniqueArticlesSold: Number(row?.unique_articles || 0),
    invoiceCount,
  };
}

async function getRevenueByMonth(
  startDate: Date,
  endDate: Date,
  categoryId?: number
): Promise<RevenueByMonth[]> {
  const categoryCondition = categoryId ? `AND a.category_id = ${categoryId}` : '';

  const result = await prisma.$queryRawUnsafe<
    Array<{
      month: Date;
      revenue: number | null;
      units: number | null;
      invoice_count: number | null;
    }>
  >(
    `SELECT
      date_trunc('month', i.invoice_date) as month,
      COALESCE(SUM(${REVENUE_USD_EXPR}), 0) as revenue,
      COALESCE(SUM(ii.quantity), 0) as units,
      COUNT(DISTINCT ii.invoice_id) as invoice_count
    FROM invoice_items ii
    INNER JOIN invoices i ON ii.invoice_id = i.id
    INNER JOIN articles a ON ii.article_id = a.id
    WHERE i.is_printed = true
      AND i.is_cancelled = false
      AND i.deleted_at IS NULL
      AND i.invoice_date >= $1
      AND i.invoice_date <= $2
      ${categoryCondition}
    GROUP BY date_trunc('month', i.invoice_date)
    ORDER BY month ASC`,
    startDate,
    endDate
  );

  return result.map((row) => {
    const date = new Date(row.month);
    return {
      month: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
      label: date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      revenue: Number(row.revenue || 0),
      units: Number(row.units || 0),
      invoiceCount: Number(row.invoice_count || 0),
    };
  });
}

async function getSalesByCategory(startDate: Date, endDate: Date): Promise<SalesByCategory[]> {
  const result = await prisma.$queryRawUnsafe<
    Array<{
      category_id: number;
      category_name: string;
      revenue: number | null;
    }>
  >(
    `SELECT
      c.id as category_id,
      c.name as category_name,
      COALESCE(SUM(${REVENUE_USD_EXPR}), 0) as revenue
    FROM invoice_items ii
    INNER JOIN invoices i ON ii.invoice_id = i.id
    INNER JOIN articles a ON ii.article_id = a.id
    INNER JOIN categories c ON a.category_id = c.id
    WHERE i.is_printed = true
      AND i.is_cancelled = false
      AND i.deleted_at IS NULL
      AND i.invoice_date >= $1
      AND i.invoice_date <= $2
    GROUP BY c.id, c.name
    ORDER BY revenue DESC`,
    startDate,
    endDate
  );

  const totalRevenue = result.reduce((sum, row) => sum + Number(row.revenue || 0), 0);

  return result.map((row) => {
    const revenue = Number(row.revenue || 0);
    return {
      categoryId: Number(row.category_id),
      categoryName: row.category_name,
      revenue,
      percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
    };
  });
}

async function getTopArticles(
  startDate: Date,
  endDate: Date,
  categoryId?: number,
  limit: number = 10
): Promise<TopArticle[]> {
  const categoryCondition = categoryId ? `AND a.category_id = ${categoryId}` : '';

  const result = await prisma.$queryRawUnsafe<
    Array<{
      article_id: bigint;
      code: string;
      description: string;
      category_name: string;
      revenue: number | null;
      units: number | null;
    }>
  >(
    `SELECT
      a.id as article_id,
      a.code,
      a.description,
      c.name as category_name,
      COALESCE(SUM(${REVENUE_USD_EXPR}), 0) as revenue,
      COALESCE(SUM(ii.quantity), 0) as units
    FROM invoice_items ii
    INNER JOIN invoices i ON ii.invoice_id = i.id
    INNER JOIN articles a ON ii.article_id = a.id
    LEFT JOIN categories c ON a.category_id = c.id
    WHERE i.is_printed = true
      AND i.is_cancelled = false
      AND i.deleted_at IS NULL
      AND i.invoice_date >= $1
      AND i.invoice_date <= $2
      ${categoryCondition}
    GROUP BY a.id, a.code, a.description, c.name
    ORDER BY revenue DESC
    LIMIT ${limit}`,
    startDate,
    endDate
  );

  return result.map((row) => ({
    articleId: Number(row.article_id),
    code: row.code,
    description: row.description,
    categoryName: row.category_name || 'Sin categoría',
    revenue: Number(row.revenue || 0),
    units: Number(row.units || 0),
  }));
}

async function getStockEvolution(monthsBack: number = 24): Promise<StockEvolutionPoint[]> {
  // 1. Get current total stock value (USD)
  const currentStockResult = await prisma.$queryRaw<Array<{ total_value: number | null }>>`
    SELECT COALESCE(SUM(stock * unit_price), 0) as total_value
    FROM articles
    WHERE deleted_at IS NULL
      AND is_discontinued = false
  `;

  const currentStockValue = Number(currentStockResult[0]?.total_value || 0);

  // 2. Get net stock movements by month (positive = stock increase, negative = stock decrease)
  // movement_type: 1=Purchase(+), 2=Sale(-), 3=Return(+), 4=Adjustment(+/-), 5=Transfer(0)
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const movements = await prisma.$queryRaw<
    Array<{
      month: Date;
      net_value_change: number | null;
    }>
  >`
    SELECT
      date_trunc('month', sm.movement_date) as month,
      SUM(
        CASE
          WHEN sm.movement_type IN (1, 3) THEN sm.quantity * a.unit_price
          WHEN sm.movement_type = 2 THEN -sm.quantity * a.unit_price
          WHEN sm.movement_type = 4 THEN sm.quantity * a.unit_price
          ELSE 0
        END
      ) as net_value_change
    FROM stock_movements sm
    INNER JOIN articles a ON sm.article_id = a.id
    WHERE sm.movement_date >= ${startDate}
      AND a.deleted_at IS NULL
    GROUP BY date_trunc('month', sm.movement_date)
    ORDER BY month ASC
  `;

  // 3. Build monthly map of net changes
  const monthlyChanges = new Map<string, number>();
  for (const row of movements) {
    const date = new Date(row.month);
    const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    monthlyChanges.set(key, Number(row.net_value_change || 0));
  }

  // 4. Generate all months in range
  const today = new Date();
  const monthsArray: { year: number; month: number; key: string; label: string }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthsArray.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      key: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
      label: date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
    });
  }

  // 5. Walk backwards from current stock value to reconstruct history
  const points: StockEvolutionPoint[] = [];
  let runningValue = currentStockValue;

  // Start from the most recent month and work backwards
  for (let i = monthsArray.length - 1; i >= 0; i--) {
    const m = monthsArray[i];
    points.unshift({
      month: m.key,
      label: m.label,
      totalStockValue: Math.max(0, runningValue),
    });
    // Reverse the change to get the previous month's value
    const change = monthlyChanges.get(m.key) || 0;
    runningValue -= change;
  }

  return points;
}

function getStockEvolutionMonths(params: SalesAnalyticsParams): number {
  if (params.startDate && params.endDate) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(months, 6);
  }
  return Math.max(params.periodMonths, 24);
}

export async function getSalesAnalytics(
  params: SalesAnalyticsParams
): Promise<SalesAnalyticsResponse> {
  const cacheKey = getCacheKey(params);
  const now = Date.now();

  // Check cache
  const cachedTimestamp = analyticsCache.timestamps.get(cacheKey);
  const cachedData = analyticsCache.data.get(cacheKey);
  if (cachedData && cachedTimestamp && now - cachedTimestamp < CACHE_DURATION) {
    return cachedData;
  }

  const { startDate, endDate } = getDateRange(params);

  const [kpis, revenueByMonth, salesByCategory, topArticles, stockEvolution] = await Promise.all([
    getKPIs(startDate, endDate, params.categoryId),
    getRevenueByMonth(startDate, endDate, params.categoryId),
    getSalesByCategory(startDate, endDate),
    getTopArticles(startDate, endDate, params.categoryId),
    getStockEvolution(getStockEvolutionMonths(params)),
  ]);

  const result: SalesAnalyticsResponse = {
    kpis,
    revenueByMonth,
    salesByCategory,
    topArticles,
    stockEvolution,
  };

  // Update cache
  analyticsCache.data.set(cacheKey, result);
  analyticsCache.timestamps.set(cacheKey, now);

  return result;
}
