import { ClientStatus, ClientClassificationConfig } from '@/types/clientClassification';
import { classifyClient, calculateRecencyScore } from '../clientClassification';

const DEFAULT_CONFIG: ClientClassificationConfig = {
  activeThresholdDays: 90,
  slowMovingThresholdDays: 180,
  inactiveThresholdDays: 365,
  minPurchasesPerMonth: 1,
  trendMonths: 12,
};

function makeClient(id = 1n) {
  return { id, code: `C${id}`, business_name: `Client ${id}` };
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

describe('calculateRecencyScore', () => {
  it('returns 0 for null days', () => {
    expect(calculateRecencyScore(null, DEFAULT_CONFIG)).toBe(0);
  });

  it('returns 100 for days within active threshold', () => {
    expect(calculateRecencyScore(0, DEFAULT_CONFIG)).toBe(100);
    expect(calculateRecencyScore(45, DEFAULT_CONFIG)).toBe(100);
    expect(calculateRecencyScore(90, DEFAULT_CONFIG)).toBe(100);
  });

  it('returns 0 for days at or beyond inactive threshold', () => {
    expect(calculateRecencyScore(365, DEFAULT_CONFIG)).toBe(0);
    expect(calculateRecencyScore(500, DEFAULT_CONFIG)).toBe(0);
  });

  it('interpolates linearly between active and inactive thresholds', () => {
    // Midpoint between 90 and 365 = 227.5 days
    // Score = 100 - ((227.5 - 90) / (365 - 90)) * 100 = 100 - 50 = 50
    expect(calculateRecencyScore(227.5, DEFAULT_CONFIG)).toBeCloseTo(50, 0);
  });

  it('handles custom config thresholds', () => {
    const config: ClientClassificationConfig = {
      ...DEFAULT_CONFIG,
      activeThresholdDays: 30,
      inactiveThresholdDays: 180,
    };
    expect(calculateRecencyScore(30, config)).toBe(100);
    expect(calculateRecencyScore(180, config)).toBe(0);
    // Midpoint: 105 days -> score ~50
    expect(calculateRecencyScore(105, config)).toBeCloseTo(50, 0);
  });
});

describe('classifyClient', () => {
  const now = new Date();

  it('classifies client with no purchase history as NEVER_PURCHASED', () => {
    const result = classifyClient(makeClient(), undefined, undefined, [], now, DEFAULT_CONFIG);
    expect(result.status).toBe(ClientStatus.NEVER_PURCHASED);
    expect(result.daysSinceLastPurchase).toBeNull();
    expect(result.totalPurchasesInPeriod).toBe(0);
    expect(result.totalRevenueInPeriod).toBe(0);
  });

  it('classifies client with no historical purchases as NEVER_PURCHASED', () => {
    const invoiceData = { total_invoices: 0n, total_amount: 0, last_invoice_date: null };
    const historicalData = { lifetime_total: 0, last_purchase_date: null };
    const result = classifyClient(
      makeClient(),
      invoiceData,
      historicalData,
      [],
      now,
      DEFAULT_CONFIG
    );
    expect(result.status).toBe(ClientStatus.NEVER_PURCHASED);
  });

  it('classifies recent frequent buyer as ACTIVE', () => {
    const lastPurchase = daysAgo(10);
    const invoiceData = {
      total_invoices: 15n,
      total_amount: 50000,
      last_invoice_date: lastPurchase,
    };
    const historicalData = { lifetime_total: 100000, last_purchase_date: lastPurchase };
    const result = classifyClient(
      makeClient(),
      invoiceData,
      historicalData,
      [1000, 2000, 3000, 4000],
      now,
      DEFAULT_CONFIG
    );
    // 15 purchases / 12 months = 1.25 >= minPurchasesPerMonth(1) and days <= 90
    expect(result.status).toBe(ClientStatus.ACTIVE);
  });

  it('classifies recent but infrequent buyer as SLOW_MOVING', () => {
    const lastPurchase = daysAgo(30);
    const invoiceData = {
      total_invoices: 5n,
      total_amount: 10000,
      last_invoice_date: lastPurchase,
    };
    const historicalData = { lifetime_total: 20000, last_purchase_date: lastPurchase };
    const result = classifyClient(
      makeClient(),
      invoiceData,
      historicalData,
      [0, 0, 0, 1000],
      now,
      DEFAULT_CONFIG
    );
    // 5 / 12 = 0.41 < minPurchasesPerMonth(1), but days <= 90
    expect(result.status).toBe(ClientStatus.SLOW_MOVING);
  });

  it('classifies client with purchase >90 days and <=180 days ago as SLOW_MOVING', () => {
    const lastPurchase = daysAgo(120);
    const invoiceData = { total_invoices: 3n, total_amount: 5000, last_invoice_date: lastPurchase };
    const historicalData = { lifetime_total: 15000, last_purchase_date: lastPurchase };
    const result = classifyClient(
      makeClient(),
      invoiceData,
      historicalData,
      [],
      now,
      DEFAULT_CONFIG
    );
    expect(result.status).toBe(ClientStatus.SLOW_MOVING);
  });

  it('classifies client with purchase >365 days ago as INACTIVE', () => {
    const lastPurchase = daysAgo(400);
    const invoiceData = { total_invoices: 1n, total_amount: 1000, last_invoice_date: lastPurchase };
    const historicalData = { lifetime_total: 5000, last_purchase_date: lastPurchase };
    const result = classifyClient(
      makeClient(),
      invoiceData,
      historicalData,
      [],
      now,
      DEFAULT_CONFIG
    );
    expect(result.status).toBe(ClientStatus.INACTIVE);
  });

  it('calculates average monthly revenue correctly', () => {
    const invoiceData = {
      total_invoices: 12n,
      total_amount: 120000,
      last_invoice_date: daysAgo(5),
    };
    const historicalData = { lifetime_total: 200000, last_purchase_date: daysAgo(5) };
    const result = classifyClient(
      makeClient(),
      invoiceData,
      historicalData,
      [],
      now,
      DEFAULT_CONFIG
    );
    // 120000 / 12 months = 10000
    expect(result.avgMonthlyRevenue).toBe(10000);
  });

  it('calculates average order value correctly', () => {
    const invoiceData = { total_invoices: 4n, total_amount: 20000, last_invoice_date: daysAgo(5) };
    const historicalData = { lifetime_total: 30000, last_purchase_date: daysAgo(5) };
    const result = classifyClient(
      makeClient(),
      invoiceData,
      historicalData,
      [],
      now,
      DEFAULT_CONFIG
    );
    // 20000 / 4 = 5000
    expect(result.averageOrderValue).toBe(5000);
  });

  it('sets averageOrderValue to 0 when no purchases', () => {
    const result = classifyClient(makeClient(), undefined, undefined, [], now, DEFAULT_CONFIG);
    expect(result.averageOrderValue).toBe(0);
  });

  it('calculates purchase frequency correctly', () => {
    const invoiceData = { total_invoices: 24n, total_amount: 50000, last_invoice_date: daysAgo(5) };
    const historicalData = { lifetime_total: 100000, last_purchase_date: daysAgo(5) };
    const result = classifyClient(
      makeClient(),
      invoiceData,
      historicalData,
      [],
      now,
      DEFAULT_CONFIG
    );
    // 24 / 12 = 2.0 purchases per month
    expect(result.purchaseFrequency).toBe(2);
  });

  it('includes customer lifetime value from historical data', () => {
    const invoiceData = { total_invoices: 5n, total_amount: 10000, last_invoice_date: daysAgo(10) };
    const historicalData = { lifetime_total: 500000, last_purchase_date: daysAgo(10) };
    const result = classifyClient(
      makeClient(),
      invoiceData,
      historicalData,
      [],
      now,
      DEFAULT_CONFIG
    );
    expect(result.customerLifetimeValue).toBe(500000);
  });

  it('calculates RFM score as average of three components', () => {
    const invoiceData = {
      total_invoices: 24n,
      total_amount: 500000,
      last_invoice_date: daysAgo(1),
    };
    const historicalData = { lifetime_total: 1000000, last_purchase_date: daysAgo(1) };
    const result = classifyClient(
      makeClient(),
      invoiceData,
      historicalData,
      [],
      now,
      DEFAULT_CONFIG
    );
    expect(result.rfmScore).toBe(
      (result.recencyScore + result.frequencyScore + result.monetaryScore) / 3
    );
  });

  it('populates client metadata fields', () => {
    const client = { id: 42n, code: 'CLI042', business_name: 'Test Corp' };
    const result = classifyClient(client, undefined, undefined, [], now, DEFAULT_CONFIG);
    expect(result.clientId).toBe('42');
    expect(result.clientCode).toBe('CLI042');
    expect(result.clientBusinessName).toBe('Test Corp');
  });

  it('stores trend and trend direction', () => {
    const trend = [100, 200, 300, 400];
    const invoiceData = { total_invoices: 20n, total_amount: 50000, last_invoice_date: daysAgo(5) };
    const historicalData = { lifetime_total: 100000, last_purchase_date: daysAgo(5) };
    const result = classifyClient(
      makeClient(),
      invoiceData,
      historicalData,
      trend,
      now,
      DEFAULT_CONFIG
    );
    expect(result.purchasesTrend).toEqual(trend);
    expect(result.trendDirection).toBe('increasing');
  });
});
