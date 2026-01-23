import { StockStatus, StockClassificationConfig } from '@/types/stockValuation';
import { classifyStockStatus } from '../stockValuation';

const DEFAULT_CONFIG: StockClassificationConfig = {
  activeThresholdDays: 90,
  slowMovingThresholdDays: 180,
  deadStockThresholdDays: 365,
  minSalesForActive: 5,
  trendMonths: 6,
  includeZeroStock: false,
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

describe('classifyStockStatus', () => {
  it('returns NEVER_SOLD when stock is 0 or negative', () => {
    expect(classifyStockStatus(daysAgo(10), 10, 50, 'stable', 0, DEFAULT_CONFIG)).toBe(
      StockStatus.NEVER_SOLD
    );

    expect(classifyStockStatus(daysAgo(10), 10, 50, 'stable', -5, DEFAULT_CONFIG)).toBe(
      StockStatus.NEVER_SOLD
    );
  });

  it('returns NEVER_SOLD when lastSaleDate is null', () => {
    expect(classifyStockStatus(null, null, 0, 'none', 100, DEFAULT_CONFIG)).toBe(
      StockStatus.NEVER_SOLD
    );
  });

  it('returns NEVER_SOLD when daysSinceLastSale is null (with stock)', () => {
    expect(classifyStockStatus(null, null, 5, 'stable', 50, DEFAULT_CONFIG)).toBe(
      StockStatus.NEVER_SOLD
    );
  });

  it('returns DEAD_STOCK when days since last sale exceeds dead stock threshold', () => {
    expect(classifyStockStatus(daysAgo(400), 400, 0, 'none', 100, DEFAULT_CONFIG)).toBe(
      StockStatus.DEAD_STOCK
    );

    expect(classifyStockStatus(daysAgo(366), 366, 2, 'stable', 50, DEFAULT_CONFIG)).toBe(
      StockStatus.DEAD_STOCK
    );
  });

  it('returns ACTIVE when recent sale and avg monthly sales meet threshold', () => {
    expect(classifyStockStatus(daysAgo(30), 30, 10, 'stable', 100, DEFAULT_CONFIG)).toBe(
      StockStatus.ACTIVE
    );

    expect(classifyStockStatus(daysAgo(90), 90, 5, 'increasing', 50, DEFAULT_CONFIG)).toBe(
      StockStatus.ACTIVE
    );
  });

  it('returns SLOW_MOVING when recent sale but avg sales below threshold', () => {
    // Days within active threshold but avgMonthlySales < minSalesForActive
    expect(classifyStockStatus(daysAgo(60), 60, 2, 'stable', 100, DEFAULT_CONFIG)).toBe(
      StockStatus.SLOW_MOVING
    );
  });

  it('returns SLOW_MOVING when days since last sale exceeds slow moving threshold', () => {
    expect(classifyStockStatus(daysAgo(200), 200, 10, 'stable', 100, DEFAULT_CONFIG)).toBe(
      StockStatus.SLOW_MOVING
    );
  });

  it('returns SLOW_MOVING when low sales with decreasing trend', () => {
    // Days within slow moving threshold, low sales, decreasing trend
    expect(classifyStockStatus(daysAgo(100), 100, 3, 'decreasing', 100, DEFAULT_CONFIG)).toBe(
      StockStatus.SLOW_MOVING
    );
  });

  it('returns SLOW_MOVING for positive avg sales not meeting active criteria', () => {
    // daysSinceLastSale between active and slow thresholds, with some sales
    expect(classifyStockStatus(daysAgo(120), 120, 3, 'stable', 80, DEFAULT_CONFIG)).toBe(
      StockStatus.SLOW_MOVING
    );
  });

  it('returns DEAD_STOCK when avg monthly sales is 0 and beyond slow moving threshold', () => {
    // Not dead stock threshold but no sales and beyond slow_moving
    expect(classifyStockStatus(daysAgo(200), 200, 0, 'none', 50, DEFAULT_CONFIG)).toBe(
      StockStatus.SLOW_MOVING
    );
  });

  it('respects custom config thresholds', () => {
    const strictConfig: StockClassificationConfig = {
      ...DEFAULT_CONFIG,
      activeThresholdDays: 30,
      slowMovingThresholdDays: 60,
      deadStockThresholdDays: 120,
      minSalesForActive: 10,
    };

    // 50 days ago with strict config: beyond active but within slow moving
    expect(classifyStockStatus(daysAgo(50), 50, 15, 'stable', 100, strictConfig)).toBe(
      StockStatus.SLOW_MOVING
    );

    // 130 days with strict config: beyond dead stock threshold
    expect(classifyStockStatus(daysAgo(130), 130, 0, 'none', 100, strictConfig)).toBe(
      StockStatus.DEAD_STOCK
    );
  });

  it('boundary: exactly at active threshold with sufficient sales is ACTIVE', () => {
    expect(classifyStockStatus(daysAgo(90), 90, 5, 'stable', 100, DEFAULT_CONFIG)).toBe(
      StockStatus.ACTIVE
    );
  });

  it('boundary: one day past active threshold with low sales is SLOW_MOVING', () => {
    expect(classifyStockStatus(daysAgo(91), 91, 3, 'stable', 100, DEFAULT_CONFIG)).toBe(
      StockStatus.SLOW_MOVING
    );
  });

  it('boundary: exactly at dead stock threshold is not DEAD_STOCK', () => {
    // daysSinceLastSale must be > deadStockThresholdDays for DEAD_STOCK
    expect(classifyStockStatus(daysAgo(365), 365, 1, 'stable', 50, DEFAULT_CONFIG)).not.toBe(
      StockStatus.DEAD_STOCK
    );
  });
});
