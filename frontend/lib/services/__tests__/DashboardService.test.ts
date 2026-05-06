import {
  getAlerts,
  getCharts,
  getMetrics,
  getOperationalMetrics,
  getTopArticlesSold,
} from '../DashboardService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockExecuteXerpScalar = jest.fn();
const mockExecuteXerpQuery = jest.fn();
jest.mock('@/lib/db/xerp', () => ({
  executeXerpScalar: (...args: unknown[]) => mockExecuteXerpScalar(...args),
  executeXerpQuery: (...args: unknown[]) => mockExecuteXerpQuery(...args),
}));

jest.mock('@/lib/db/xerpQueries', () => ({
  XERP_BILLED_MONTHLY_NET: 'BILLED_MONTHLY_NET',
  XERP_BILLED_TODAY_NET: 'BILLED_TODAY_NET',
  XERP_BILLED_PREV_MONTH_NET: 'BILLED_PREV_MONTH_NET',
  XERP_BILLED_SAME_MONTH_PREV_YEAR_NET: 'BILLED_SAME_MONTH_PREV_YEAR_NET',
  XERP_MONTHLY_SALES_TREND_NET: 'MONTHLY_SALES_TREND_NET',
}));

const mockSystemSettingsFindFirst = jest.fn();
const mockQueryRawUnsafe = jest.fn();
jest.mock('@/lib/db', () => ({
  prisma: {
    system_settings: {
      findFirst: (...args: unknown[]) => mockSystemSettingsFindFirst(...args),
    },
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
  },
}));

const mockCalculateStockValuation = jest.fn();
jest.mock('@/lib/utils/articles/stockValuation', () => ({
  calculateStockValuation: (...args: unknown[]) => mockCalculateStockValuation(...args),
}));

const mockGetSalesAnalytics = jest.fn();
jest.mock('@/lib/services/SalesAnalyticsService', () => ({
  getSalesAnalytics: (...args: unknown[]) => mockGetSalesAnalytics(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSystemSettingsFindFirst.mockResolvedValue({ usd_exchange_rate: 1000 });
});

// Pattern-match SQL fragments so test setup is order-independent.
function mockQueriesByFragment(handlers: Array<{ match: string; rows: unknown[] }>) {
  mockQueryRawUnsafe.mockImplementation((sql: string) => {
    for (const h of handlers) {
      if (sql.includes(h.match)) return Promise.resolve(h.rows);
    }
    return Promise.resolve([]);
  });
}

// Build a minimal valuation result with the byStatus shape we consume.
function valuationStub(overrides?: {
  totalStockValue?: number;
  totalValueAtListPrice?: number;
  deadCount?: number;
  deadValue?: number;
  neverCount?: number;
  neverValue?: number;
  topArticles?: Array<{ articleId: number; currentStock: number; status: string }>;
}) {
  const top = overrides?.topArticles ?? [];
  return {
    totals: {
      totalStockValue: overrides?.totalStockValue ?? 0,
      totalValueAtListPrice: overrides?.totalValueAtListPrice ?? 0,
      totalArticles: top.length,
      paymentTermsValuation: [],
    },
    byStatus: {
      active: {
        count: 0,
        totalValue: 0,
        totalValueAtListPrice: 0,
        paymentTermsValuation: [],
        articles: [],
      },
      slow_moving: {
        count: 0,
        totalValue: 0,
        totalValueAtListPrice: 0,
        paymentTermsValuation: [],
        articles: [],
      },
      dead_stock: {
        count: overrides?.deadCount ?? 0,
        totalValue: overrides?.deadValue ?? 0,
        totalValueAtListPrice: 0,
        paymentTermsValuation: [],
        articles: [],
      },
      never_sold: {
        count: overrides?.neverCount ?? 0,
        totalValue: overrides?.neverValue ?? 0,
        totalValueAtListPrice: 0,
        paymentTermsValuation: [],
        articles: top
          .filter((a) => a.status === 'never_sold')
          .map((a) => ({
            articleId: String(a.articleId),
            currentStock: a.currentStock,
            status: a.status,
          })),
      },
    },
    byCategory: [],
    calculatedAt: new Date(),
    config: {},
  };
}

// ─── getMetrics ───────────────────────────────────────────────────────────────

describe('getMetrics', () => {
  it('aggregates billed (xERP NET), outstanding/overdue/collect/checks (sync_*) and margin', async () => {
    mockExecuteXerpScalar
      .mockResolvedValueOnce(17_100_000) // billedMonthly
      .mockResolvedValueOnce(1_300_000) // billedToday
      .mockResolvedValueOnce(15_000_000) // billedPrevMonth
      .mockResolvedValueOnce(12_000_000); // billedSameMonthPrevYear

    // Order matters less now thanks to fragment-matching, but more specific
    // patterns first to disambiguate.
    mockQueriesByFragment([
      {
        match: 'FROM sync_balances',
        rows: [{ total_outstanding: 45_500_000, total_overdue: 7_900_000 }],
      },
      {
        match: 'EXTRACT(MONTH FROM payment_date)',
        rows: [
          {
            total: 22_300_000,
            cleared: 8_300_000,
            pending: 14_000_000,
            transaction_count: 25,
          },
        ],
      },
      {
        match: 'WHERE type = 0',
        rows: [{ amount: 15_100_000 }],
      },
      {
        match: 'FROM invoice_items',
        rows: [{ revenue_usd: 100, cogs_usd: 60 }],
      },
    ]);

    const result = await getMetrics();

    expect(result.errors).toEqual({ xerp: null, spisa: null });
    expect(result.totalOutstanding).toBe(45_500_000);
    expect(result.totalOverdue).toBe(7_900_000);
    expect(result.billedMonthly).toBe(17_100_000);
    expect(result.billedToday).toBe(1_300_000);
    expect(result.billedPrevMonth).toBe(15_000_000);
    expect(result.billedSameMonthPrevYear).toBe(12_000_000);
    expect(result.toCollectMonthly).toEqual({
      total: 22_300_000,
      cleared: 8_300_000,
      pending: 14_000_000,
      transactionCount: 25,
    });
    expect(result.checksInPortfolio).toBe(15_100_000);
    expect(result.grossMarginPercent).toBeCloseTo(40);
    expect(result.grossMarginAmountArs).toBeCloseTo(40 * 1000);
  });

  it('captures xerp error in errors.xerp without breaking SPISA fields', async () => {
    mockExecuteXerpScalar.mockRejectedValue(new Error('xERP firewall blocked'));
    mockQueriesByFragment([
      {
        match: 'FROM sync_balances',
        rows: [{ total_outstanding: 1000, total_overdue: 0 }],
      },
      {
        match: 'EXTRACT(MONTH FROM payment_date)',
        rows: [{ total: 0, cleared: 0, pending: 0, transaction_count: 0 }],
      },
      { match: 'WHERE type = 0', rows: [{ amount: 0 }] },
      { match: 'FROM invoice_items', rows: [{ revenue_usd: 0, cogs_usd: 0 }] },
    ]);

    const result = await getMetrics();

    expect(result.errors.xerp).toBe('xERP firewall blocked');
    expect(result.errors.spisa).toBeNull();
    expect(result.billedMonthly).toBeNull();
    expect(result.totalOutstanding).toBe(1000);
  });

  it('captures spisa error in errors.spisa without breaking xERP fields', async () => {
    mockExecuteXerpScalar.mockResolvedValue(0);
    mockQueryRawUnsafe.mockRejectedValue(new Error('PG connection refused'));
    mockSystemSettingsFindFirst.mockRejectedValue(new Error('PG connection refused'));

    const result = await getMetrics();

    expect(result.errors.xerp).toBeNull();
    expect(result.errors.spisa).toBe('PG connection refused');
    expect(result.billedMonthly).toBe(0);
    expect(result.totalOutstanding).toBeNull();
    expect(result.toCollectMonthly).toBeNull();
  });
});

// ─── getCharts ────────────────────────────────────────────────────────────────

describe('getCharts', () => {
  it('returns NET sales trend (xERP) and top customers with risk classification (sync_*)', async () => {
    const trend = [{ Year: 2026, Month: 5, MonthName: 'May', MonthlyRevenue: 17_100_000 }];
    mockExecuteXerpQuery.mockResolvedValueOnce(trend);

    mockQueriesByFragment([
      {
        match: 'FROM sync_customers',
        rows: [
          { name: 'PAZ LUCAS', outstanding_balance: 12_500_000, overdue_amount: 7_000_000 }, // 56% → HIGH
          { name: 'PROINDSUR', outstanding_balance: 9_400_000, overdue_amount: 3_000_000 }, // 31.9% → MEDIUM
          { name: 'AMIANGRAF', outstanding_balance: 3_800_000, overdue_amount: 0 }, // 0% → LOW
        ],
      },
      {
        match: 'FROM invoices i',
        rows: [
          {
            client_id: BigInt(7),
            business_name: 'PAZ LUCAS',
            revenue_ars: 5_000_000,
            invoice_count: 4,
          },
        ],
      },
    ]);

    const result = await getCharts();

    expect(result.errors).toEqual({ xerp: null, spisa: null });
    expect(result.salesTrend).toEqual(trend);
    expect(result.topCustomers).toHaveLength(3);
    expect(result.topCustomers[0].RiskLevel).toBe('HIGH');
    expect(result.topCustomers[1].RiskLevel).toBe('MEDIUM');
    expect(result.topCustomers[2].RiskLevel).toBe('LOW');
    expect(result.topCustomersByRevenue).toEqual([
      { clientId: 7, businessName: 'PAZ LUCAS', revenueArs: 5_000_000, invoiceCount: 4 },
    ]);
  });

  it('isolates xERP failure from SPISA results', async () => {
    mockExecuteXerpQuery.mockRejectedValue(new Error('xERP timeout'));
    mockQueriesByFragment([
      { match: 'FROM sync_customers', rows: [] },
      { match: 'FROM invoices i', rows: [] },
    ]);

    const result = await getCharts();

    expect(result.errors.xerp).toBe('xERP timeout');
    expect(result.errors.spisa).toBeNull();
    expect(result.salesTrend).toEqual([]);
    expect(result.topCustomers).toEqual([]);
  });
});

// ─── getOperationalMetrics ────────────────────────────────────────────────────

describe('getOperationalMetrics', () => {
  it('reads stock + dead stock from calculateStockValuation, stockouts from SQL', async () => {
    mockCalculateStockValuation.mockResolvedValue(
      valuationStub({
        totalStockValue: 7_500_000,
        totalValueAtListPrice: 12_000_000,
        deadCount: 8,
        deadValue: 800_000,
        neverCount: 4,
        neverValue: 400_000,
      })
    );
    mockQueriesByFragment([{ match: 'AND a.stock <= 0', rows: [{ count: 5 }] }]);

    const result = await getOperationalMetrics();

    expect(result.error).toBeNull();
    expect(result.stockValueCost).toBe(7_500_000);
    expect(result.stockValueRetail).toBe(12_000_000);
    expect(result.deadStockValue).toBe(1_200_000); // 800k + 400k
    expect(result.deadStockArticleCount).toBe(12); // 8 + 4
    expect(result.stockoutsCriticalCount).toBe(5);
  });

  it('captures error and returns zeroes if valuation fails', async () => {
    mockCalculateStockValuation.mockRejectedValue(new Error('valuation cache miss'));

    const result = await getOperationalMetrics();

    expect(result.error).toBe('valuation cache miss');
    expect(result.stockValueCost).toBe(0);
    expect(result.deadStockValue).toBe(0);
  });
});

// ─── getTopArticlesSold ───────────────────────────────────────────────────────

describe('getTopArticlesSold', () => {
  it('joins SalesAnalyticsService topArticles with valuation enrichment', async () => {
    mockGetSalesAnalytics.mockResolvedValue({
      topArticles: [
        {
          articleId: 1,
          code: 'A001',
          description: 'Reducción 1/2"',
          revenue: 5000,
          units: 120,
          categoryName: 'Cat',
        },
        {
          articleId: 2,
          code: 'A002',
          description: 'Codo 90°',
          revenue: 3000,
          units: 80,
          categoryName: 'Cat',
        },
      ],
      kpis: {},
      revenueByMonth: [],
      salesByCategory: [],
      stockEvolution: [],
    });
    mockCalculateStockValuation.mockResolvedValue({
      totals: {
        totalStockValue: 0,
        totalValueAtListPrice: 0,
        totalArticles: 0,
        paymentTermsValuation: [],
      },
      byStatus: {
        active: {
          count: 1,
          totalValue: 0,
          totalValueAtListPrice: 0,
          paymentTermsValuation: [],
          articles: [{ articleId: '1', currentStock: 35, status: 'active' }],
        },
        slow_moving: {
          count: 0,
          totalValue: 0,
          totalValueAtListPrice: 0,
          paymentTermsValuation: [],
          articles: [],
        },
        dead_stock: {
          count: 0,
          totalValue: 0,
          totalValueAtListPrice: 0,
          paymentTermsValuation: [],
          articles: [],
        },
        never_sold: {
          count: 1,
          totalValue: 0,
          totalValueAtListPrice: 0,
          paymentTermsValuation: [],
          articles: [{ articleId: '2', currentStock: 0, status: 'never_sold' }],
        },
      },
      byCategory: [],
      calculatedAt: new Date(),
      config: {},
    });

    const result = await getTopArticlesSold();

    expect(result.error).toBeNull();
    expect(result.articles).toHaveLength(2);
    expect(result.articles[0]).toEqual({
      articleId: 1,
      code: 'A001',
      description: 'Reducción 1/2"',
      unitsSold: 120,
      revenueUsd: 5000,
      currentStock: 35,
      status: 'active',
    });
    expect(result.articles[1].currentStock).toBe(0);
    expect(result.articles[1].status).toBe('never_sold');
  });

  it('returns empty + null error when there are no top articles', async () => {
    mockGetSalesAnalytics.mockResolvedValue({
      topArticles: [],
      kpis: {},
      revenueByMonth: [],
      salesByCategory: [],
      stockEvolution: [],
    });

    const result = await getTopArticlesSold();

    expect(result.error).toBeNull();
    expect(result.articles).toEqual([]);
  });

  it('captures error from analytics service', async () => {
    mockGetSalesAnalytics.mockRejectedValue(new Error('analytics down'));

    const result = await getTopArticlesSold();

    expect(result.error).toBe('analytics down');
    expect(result.articles).toEqual([]);
  });
});

// ─── getAlerts ────────────────────────────────────────────────────────────────

describe('getAlerts', () => {
  it('returns counts for stockouts, late proformas, and stale quotes', async () => {
    mockQueriesByFragment([
      { match: 'FROM supplier_orders', rows: [{ count: 2 }] },
      { match: "INTERVAL '14 days'", rows: [{ count: 7 }] },
      { match: 'AND a.stock <= 0', rows: [{ count: 5 }] },
    ]);

    const result = await getAlerts();

    expect(result.stockoutsCount).toBe(5);
    expect(result.lateProformasCount).toBe(2);
    expect(result.pendingQuotesCount).toBe(7);
  });

  it('defaults to zero on empty rows', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    const result = await getAlerts();

    expect(result.stockoutsCount).toBe(0);
    expect(result.lateProformasCount).toBe(0);
    expect(result.pendingQuotesCount).toBe(0);
  });
});
