import { getAlerts, getCharts, getMetrics, getOperationalMetrics } from '../DashboardService';

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

beforeEach(() => {
  jest.clearAllMocks();
  mockSystemSettingsFindFirst.mockResolvedValue({ usd_exchange_rate: 1000 });
});

// Pattern-match on SQL fragments so test setup doesn't depend on the exact
// Promise.all ordering inside the service.
function mockQueriesByFragment(handlers: Array<{ match: string; rows: unknown[] }>) {
  mockQueryRawUnsafe.mockImplementation((sql: string) => {
    for (const h of handlers) {
      if (sql.includes(h.match)) return Promise.resolve(h.rows);
    }
    return Promise.resolve([]);
  });
}

describe('getMetrics', () => {
  it('aggregates outstanding/billed/margin from sync_* + invoice_items', async () => {
    // Order matters: more specific matchers first (the generic "this month"
    // fragment is a substring of the "same month prev year" query).
    mockQueriesByFragment([
      {
        match: 'EXTRACT(YEAR FROM NOW())::int - 1',
        rows: [{ amount: 12_000_000 }],
      },
      {
        match: "INTERVAL '1 month'",
        rows: [{ amount: 14_000_000 }],
      },
      {
        match: 'invoice_date::date = NOW()::date',
        rows: [{ amount: 1_300_000 }],
      },
      {
        match: 'FROM sync_balances',
        rows: [{ total_outstanding: 45_500_000, total_overdue: 7_900_000 }],
      },
      {
        match: 'FROM invoice_items',
        rows: [{ revenue_usd: 100, cogs_usd: 60 }],
      },
      {
        match: 'FROM sync_transactions',
        rows: [{ amount: 17_100_000 }],
      },
    ]);

    const result = await getMetrics();

    expect(result.error).toBeNull();
    expect(result.totalOutstanding).toBe(45_500_000);
    expect(result.totalOverdue).toBe(7_900_000);
    expect(result.billedMonthly).toBe(17_100_000);
    expect(result.billedToday).toBe(1_300_000);
    expect(result.billedPrevMonth).toBe(14_000_000);
    expect(result.billedSameMonthPrevYear).toBe(12_000_000);
    expect(result.daysElapsedThisMonth).toBeGreaterThan(0);
    expect(result.dailyAverageThisMonth!).toBeCloseTo(17_100_000 / result.daysElapsedThisMonth);
    expect(result.grossMarginPercent).toBeCloseTo(40);
    expect(result.grossMarginAmountArs).toBeCloseTo(40 * 1000);
    expect(result.grossMarginPrevPercent).toBeCloseTo(40);
  });

  it('captures the error message and returns null fields on Postgres failure', async () => {
    mockQueryRawUnsafe.mockRejectedValue(new Error('PG connection refused'));

    const result = await getMetrics();

    expect(result.error).toBe('PG connection refused');
    expect(result.totalOutstanding).toBeNull();
    expect(result.totalOverdue).toBeNull();
    expect(result.billedMonthly).toBeNull();
    expect(result.billedToday).toBeNull();
    expect(result.billedPrevMonth).toBeNull();
    expect(result.billedSameMonthPrevYear).toBeNull();
    expect(result.dailyAverageThisMonth).toBeNull();
    expect(result.grossMarginPercent).toBeNull();
    expect(result.grossMarginAmountArs).toBeNull();
    expect(result.grossMarginPrevPercent).toBeNull();
  });

  it('returns null margin when no SPISA invoices in the period', async () => {
    mockQueriesByFragment([
      { match: 'FROM sync_balances', rows: [{ total_outstanding: 100, total_overdue: 0 }] },
      { match: 'FROM invoice_items', rows: [{ revenue_usd: 0, cogs_usd: 0 }] },
    ]);

    const result = await getMetrics();

    expect(result.error).toBeNull();
    expect(result.grossMarginPercent).toBeNull();
    expect(result.grossMarginAmountArs).toBeNull();
    expect(result.grossMarginPrevPercent).toBeNull();
  });
});

describe('getCharts', () => {
  it('returns top customers by AR (sync_*), monthly trend, and current-month revenue list', async () => {
    mockQueriesByFragment([
      {
        match: 'FROM sync_customers c\n      INNER JOIN sync_balances b',
        rows: [
          { name: 'PAZ LUCAS', outstanding_balance: 12_500_000, overdue_amount: 2_000_000 },
          { name: 'PROINDSUR', outstanding_balance: 9_400_000, overdue_amount: 0 },
        ],
      },
      {
        match: 'FROM sync_transactions',
        rows: [
          {
            year: 2026,
            month: 5,
            month_name: 'May',
            monthly_revenue: 17_100_000,
            invoice_count: 12,
            unique_customers: 8,
          },
        ],
      },
      {
        match: 'FROM invoices i\n    INNER JOIN sales_orders so',
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

    expect(result.error).toBeNull();
    expect(result.topCustomers).toHaveLength(2);
    expect(result.topCustomers[0]).toEqual({
      Name: 'PAZ LUCAS',
      OutstandingBalance: 12_500_000,
      OverdueAmount: 2_000_000,
      OverduePercentage: (2_000_000 / 12_500_000) * 100,
    });
    expect(result.salesTrend).toHaveLength(1);
    expect(result.salesTrend[0].Year).toBe(2026);
    expect(result.salesTrend[0].MonthlyRevenue).toBe(17_100_000);
    expect(result.topCustomersByRevenue).toEqual([
      { clientId: 7, businessName: 'PAZ LUCAS', revenueArs: 5_000_000, invoiceCount: 4 },
    ]);
  });

  it('captures error and returns empty arrays on failure', async () => {
    mockQueryRawUnsafe.mockRejectedValue(new Error('PG select failed'));

    const result = await getCharts();

    expect(result.error).toBe('PG select failed');
    expect(result.topCustomers).toEqual([]);
    expect(result.salesTrend).toEqual([]);
    expect(result.topCustomersByRevenue).toEqual([]);
  });
});

describe('getOperationalMetrics', () => {
  it('aggregates stock value, dead stock, stockouts and pending invoices', async () => {
    mockSystemSettingsFindFirst.mockResolvedValue({ usd_exchange_rate: 1100 });
    mockQueriesByFragment([
      { match: 'as cost_usd', rows: [{ cost_usd: 5000, retail_ars: 7_500_000 }] },
      { match: 'as value_ars', rows: [{ value_ars: 1_200_000, article_count: 12 }] },
      { match: 'AND a.stock <= 0\n      AND EXISTS', rows: [{ count: 3 }] },
      {
        match: "AND so.status = 'PENDING'",
        rows: [{ count: 4, total_ars: 250_000 }],
      },
    ]);

    const result = await getOperationalMetrics();

    expect(result.usdExchangeRate).toBe(1100);
    expect(result.stockValueCostUsd).toBe(5000);
    expect(result.stockValueCostArs).toBe(5000 * 1100);
    expect(result.stockValueRetailArs).toBe(7_500_000);
    expect(result.deadStockValueArs).toBe(1_200_000);
    expect(result.deadStockArticleCount).toBe(12);
    expect(result.stockoutsCriticalCount).toBe(3);
    expect(result.pendingToInvoiceCount).toBe(4);
    expect(result.pendingToInvoiceArs).toBe(250_000);
  });

  it('falls back to default exchange rate when system_settings is empty', async () => {
    mockSystemSettingsFindFirst.mockResolvedValue(null);
    mockQueryRawUnsafe.mockResolvedValue([]);

    const result = await getOperationalMetrics();

    expect(result.usdExchangeRate).toBe(1000);
    expect(result.stockValueCostUsd).toBe(0);
  });
});

describe('getAlerts', () => {
  it('returns counts for stockouts, late proformas, and stale quotes', async () => {
    mockQueriesByFragment([
      { match: 'AND a.stock <= 0', rows: [{ count: 5 }] },
      { match: 'FROM supplier_orders', rows: [{ count: 2 }] },
      { match: "INTERVAL '14 days'", rows: [{ count: 7 }] },
    ]);

    const result = await getAlerts();

    expect(result.stockoutsCount).toBe(5);
    expect(result.lateProformasCount).toBe(2);
    expect(result.pendingQuotesCount).toBe(7);
  });

  it('defaults to zero when queries return empty rows', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    const result = await getAlerts();

    expect(result.stockoutsCount).toBe(0);
    expect(result.lateProformasCount).toBe(0);
    expect(result.pendingQuotesCount).toBe(0);
  });
});
