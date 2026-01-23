import { getMetrics, getCharts } from '../DashboardService';

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
  XERP_TOP_CUSTOMERS: 'TOP_CUSTOMERS_QUERY',
  XERP_MONTHLY_SALES_TREND: 'MONTHLY_SALES_TREND_QUERY',
}));

describe('getMetrics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all four metrics from xerp queries', async () => {
    mockExecuteXerpScalar
      .mockResolvedValueOnce(50000) // totalOutstanding
      .mockResolvedValueOnce(10000) // totalOverdue
      .mockResolvedValueOnce(200000) // billedMonthly
      .mockResolvedValueOnce(15000); // billedToday

    const result = await getMetrics();

    expect(result).toEqual({
      totalOutstanding: 50000,
      totalOverdue: 10000,
      billedMonthly: 200000,
      billedToday: 15000,
    });
  });

  it('defaults null values to 0', async () => {
    mockExecuteXerpScalar
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await getMetrics();

    expect(result).toEqual({
      totalOutstanding: 0,
      totalOverdue: 0,
      billedMonthly: 0,
      billedToday: 0,
    });
  });

  it('calls all four scalar queries in parallel', async () => {
    mockExecuteXerpScalar.mockResolvedValue(0);

    await getMetrics();

    expect(mockExecuteXerpScalar).toHaveBeenCalledTimes(4);
    expect(mockExecuteXerpScalar).toHaveBeenCalledWith('TOTAL_OUTSTANDING_QUERY');
    expect(mockExecuteXerpScalar).toHaveBeenCalledWith('TOTAL_OVERDUE_QUERY');
    expect(mockExecuteXerpScalar).toHaveBeenCalledWith('BILLED_MONTHLY_QUERY');
    expect(mockExecuteXerpScalar).toHaveBeenCalledWith('BILLED_TODAY_QUERY');
  });
});

describe('getCharts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns top customers and sales trend', async () => {
    const customers = [{ name: 'Client A', total: 100000 }];
    const trend = [{ month: '2024-01', total: 50000 }];

    mockExecuteXerpQuery.mockResolvedValueOnce(customers).mockResolvedValueOnce(trend);

    const result = await getCharts();

    expect(result.topCustomers).toEqual(customers);
    expect(result.salesTrend).toEqual(trend);
  });

  it('defaults null results to empty arrays', async () => {
    mockExecuteXerpQuery.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const result = await getCharts();

    expect(result.topCustomers).toEqual([]);
    expect(result.salesTrend).toEqual([]);
  });

  it('calls both chart queries', async () => {
    mockExecuteXerpQuery.mockResolvedValue([]);

    await getCharts();

    expect(mockExecuteXerpQuery).toHaveBeenCalledTimes(2);
    expect(mockExecuteXerpQuery).toHaveBeenCalledWith('TOP_CUSTOMERS_QUERY');
    expect(mockExecuteXerpQuery).toHaveBeenCalledWith('MONTHLY_SALES_TREND_QUERY');
  });
});
