import { getAlerts, getCharts, getMetrics, getOperationalMetrics } from '../DashboardService';

// Mock xerp dependencies
const mockExecuteXerpScalar = jest.fn();
const mockExecuteXerpQuery = jest.fn();
jest.mock('@/lib/db/xerp', () => ({
  executeXerpScalar: (...args: unknown[]) => mockExecuteXerpScalar(...args),
  executeXerpQuery: (...args: unknown[]) => mockExecuteXerpQuery(...args),
}));

jest.mock('@/lib/db/xerpQueries', () => ({
  XERP_TOTAL_OUTSTANDING: 'TOTAL_OUTSTANDING_QUERY',
  XERP_TOTAL_OVERDUE: 'TOTAL_OVERDUE_QUERY',
  XERP_BILLED_MONTHLY: 'BILLED_MONTHLY_QUERY',
  XERP_BILLED_TODAY: 'BILLED_TODAY_QUERY',
  XERP_BILLED_PREV_MONTH: 'BILLED_PREV_MONTH_QUERY',
  XERP_BILLED_SAME_MONTH_PREV_YEAR: 'BILLED_SAME_MONTH_PREV_YEAR_QUERY',
  XERP_TOP_CUSTOMERS: 'TOP_CUSTOMERS_QUERY',
  XERP_MONTHLY_SALES_TREND: 'MONTHLY_SALES_TREND_QUERY',
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

beforeEach(() => {
  jest.clearAllMocks();
  mockSystemSettingsFindFirst.mockResolvedValue({ usd_exchange_rate: 1000 });
  mockQueryRawUnsafe.mockResolvedValue([]);
});

describe('getMetrics', () => {
  it('returns commercial pulse with deltas and gross margin', async () => {
    mockExecuteXerpScalar
      .mockResolvedValueOnce(50000) // totalOutstanding
      .mockResolvedValueOnce(10000) // totalOverdue
      .mockResolvedValueOnce(200000) // billedMonthly
      .mockResolvedValueOnce(15000) // billedToday
      .mockResolvedValueOnce(180000) // billedPrevMonth
      .mockResolvedValueOnce(150000); // billedSameMonthPrevYear

    // First margin call (current month) — has revenue, has cogs
    mockQueryRawUnsafe.mockResolvedValueOnce([{ revenue_usd: 100, cogs_usd: 60 }]);
    // Margin amount call (current month, ARS) — same data
    mockQueryRawUnsafe.mockResolvedValueOnce([{ revenue_usd: 100, cogs_usd: 60 }]);
    // Prev month margin call
    mockQueryRawUnsafe.mockResolvedValueOnce([{ revenue_usd: 100, cogs_usd: 70 }]);

    const result = await getMetrics();

    expect(result.totalOutstanding).toBe(50000);
    expect(result.totalOverdue).toBe(10000);
    expect(result.billedMonthly).toBe(200000);
    expect(result.billedToday).toBe(15000);
    expect(result.billedPrevMonth).toBe(180000);
    expect(result.billedSameMonthPrevYear).toBe(150000);
    expect(result.daysElapsedThisMonth).toBeGreaterThan(0);
    expect(result.dailyAverageThisMonth).toBeCloseTo(200000 / result.daysElapsedThisMonth);
    expect(result.grossMarginPercent).toBeCloseTo(40); // (100-60)/100 * 100
    expect(result.grossMarginAmountArs).toBeCloseTo(40 * 1000); // 40 USD * 1000 rate
    expect(result.grossMarginPrevPercent).toBeCloseTo(30); // (100-70)/100 * 100
  });

  it('defaults null xerp values to 0 and returns null margin when no revenue', async () => {
    mockExecuteXerpScalar.mockResolvedValue(null);
    // Empty invoice rows for both periods
    mockQueryRawUnsafe.mockResolvedValue([{ revenue_usd: 0, cogs_usd: 0 }]);

    const result = await getMetrics();

    expect(result.totalOutstanding).toBe(0);
    expect(result.totalOverdue).toBe(0);
    expect(result.billedMonthly).toBe(0);
    expect(result.billedToday).toBe(0);
    expect(result.billedPrevMonth).toBe(0);
    expect(result.billedSameMonthPrevYear).toBe(0);
    expect(result.dailyAverageThisMonth).toBe(0);
    expect(result.grossMarginPercent).toBeNull();
    expect(result.grossMarginAmountArs).toBeNull();
    expect(result.grossMarginPrevPercent).toBeNull();
  });

  it('calls all six xerp scalar queries in parallel', async () => {
    mockExecuteXerpScalar.mockResolvedValue(0);
    mockQueryRawUnsafe.mockResolvedValue([{ revenue_usd: 0, cogs_usd: 0 }]);

    await getMetrics();

    expect(mockExecuteXerpScalar).toHaveBeenCalledTimes(6);
    expect(mockExecuteXerpScalar).toHaveBeenCalledWith('TOTAL_OUTSTANDING_QUERY');
    expect(mockExecuteXerpScalar).toHaveBeenCalledWith('TOTAL_OVERDUE_QUERY');
    expect(mockExecuteXerpScalar).toHaveBeenCalledWith('BILLED_MONTHLY_QUERY');
    expect(mockExecuteXerpScalar).toHaveBeenCalledWith('BILLED_TODAY_QUERY');
    expect(mockExecuteXerpScalar).toHaveBeenCalledWith('BILLED_PREV_MONTH_QUERY');
    expect(mockExecuteXerpScalar).toHaveBeenCalledWith('BILLED_SAME_MONTH_PREV_YEAR_QUERY');
  });
});

describe('getCharts', () => {
  it('returns top customers, sales trend, and revenue-based top customers', async () => {
    const customers = [{ Name: 'Client A', OutstandingBalance: 100000 }];
    const trend = [{ Year: 2026, Month: 5, MonthName: 'May', MonthlyRevenue: 50000 }];
    const byRevenue = [
      {
        client_id: BigInt(7),
        business_name: 'Client X',
        revenue_ars: 30000,
        invoice_count: 4,
      },
    ];

    mockExecuteXerpQuery.mockResolvedValueOnce(customers).mockResolvedValueOnce(trend);
    mockQueryRawUnsafe.mockResolvedValueOnce(byRevenue);

    const result = await getCharts();

    expect(result.topCustomers).toEqual(customers);
    expect(result.salesTrend).toEqual(trend);
    expect(result.topCustomersByRevenue).toEqual([
      { clientId: 7, businessName: 'Client X', revenueArs: 30000, invoiceCount: 4 },
    ]);
  });

  it('defaults null xerp results to empty arrays', async () => {
    mockExecuteXerpQuery.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockQueryRawUnsafe.mockResolvedValueOnce([]);

    const result = await getCharts();

    expect(result.topCustomers).toEqual([]);
    expect(result.salesTrend).toEqual([]);
    expect(result.topCustomersByRevenue).toEqual([]);
  });
});

describe('getOperationalMetrics', () => {
  it('aggregates stock value, dead stock, stockouts and pending invoices', async () => {
    mockSystemSettingsFindFirst.mockResolvedValue({ usd_exchange_rate: 1100 });
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ cost_usd: 5000, retail_ars: 7_500_000 }]) // stock
      .mockResolvedValueOnce([{ value_ars: 1_200_000, article_count: 12 }]) // dead stock
      .mockResolvedValueOnce([{ count: 3 }]) // stockouts
      .mockResolvedValueOnce([{ count: 4, total_ars: 250_000 }]); // pending

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
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ cost_usd: 1, retail_ars: 0 }])
      .mockResolvedValueOnce([{ value_ars: 0, article_count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0, total_ars: 0 }]);

    const result = await getOperationalMetrics();

    expect(result.usdExchangeRate).toBe(1000);
    expect(result.stockValueCostArs).toBe(1000);
  });
});

describe('getAlerts', () => {
  it('returns counts for stockouts, late proformas, and stale quotes', async () => {
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ count: 5 }])
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([{ count: 7 }]);

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
