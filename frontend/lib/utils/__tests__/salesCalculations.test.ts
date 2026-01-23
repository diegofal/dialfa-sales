import {
  calculateDiscountedPrice,
  calculateLineTotal,
  calculateSubtotal,
  calculateTrendDirection,
  calculateWeightedAvgSales,
  calculateEstimatedSaleTime,
  formatSaleTime,
  calculateWeightedAvgSaleTime,
} from '../salesCalculations';

describe('calculateWeightedAvgSales', () => {
  it('returns 0 for empty or undefined input', () => {
    expect(calculateWeightedAvgSales(undefined)).toBe(0);
    expect(calculateWeightedAvgSales([])).toBe(0);
  });

  it('calculates WMA correctly with ascending weights', () => {
    // [10, 20, 30] with weights [1, 2, 3]
    // WMA = (10*1 + 20*2 + 30*3) / (1+2+3) = (10+40+90)/6 = 140/6
    const result = calculateWeightedAvgSales([10, 20, 30]);
    expect(result).toBeCloseTo(140 / 6, 5);
  });

  it('gives more weight to recent months', () => {
    // Recent high sales should yield higher average than recent low sales
    const recentHigh = calculateWeightedAvgSales([10, 10, 10, 100]);
    const recentLow = calculateWeightedAvgSales([100, 10, 10, 10]);
    expect(recentHigh).toBeGreaterThan(recentLow);
  });

  it('respects months parameter to limit window', () => {
    const fullData = [5, 5, 5, 100, 100, 100];
    const last3 = calculateWeightedAvgSales(fullData, 3);
    // Only uses [100, 100, 100] with weights [1, 2, 3]
    // WMA = (100*1 + 100*2 + 100*3) / 6 = 600/6 = 100
    expect(last3).toBe(100);
  });

  it('handles single value', () => {
    expect(calculateWeightedAvgSales([42])).toBe(42);
  });

  it('handles all zeros', () => {
    expect(calculateWeightedAvgSales([0, 0, 0])).toBe(0);
  });

  it('months parameter larger than array uses full array', () => {
    const result = calculateWeightedAvgSales([10, 20], 10);
    // Uses full array [10, 20] with weights [1, 2]
    // WMA = (10*1 + 20*2) / 3 = 50/3
    expect(result).toBeCloseTo(50 / 3, 5);
  });
});

describe('calculateEstimatedSaleTime', () => {
  it('returns Infinity when avgSales is 0', () => {
    expect(calculateEstimatedSaleTime(100, 0)).toBe(Infinity);
  });

  it('calculates months correctly', () => {
    // 100 units / 50 per month = 2 months
    expect(calculateEstimatedSaleTime(100, 50)).toBe(2);
  });

  it('handles fractional months', () => {
    // 30 units / 20 per month = 1.5 months
    expect(calculateEstimatedSaleTime(30, 20)).toBe(1.5);
  });

  it('returns 0 when quantity is 0', () => {
    expect(calculateEstimatedSaleTime(0, 10)).toBe(0);
  });
});

describe('formatSaleTime', () => {
  it('returns infinity symbol for Infinity', () => {
    expect(formatSaleTime(Infinity)).toBe('∞ Infinito');
  });

  it('returns infinity symbol for 0', () => {
    expect(formatSaleTime(0)).toBe('∞ Infinito');
  });

  it('shows days for less than 1 month', () => {
    expect(formatSaleTime(0.5)).toBe('~15 días');
  });

  it('shows ~1 mes for values between 1 and 2', () => {
    expect(formatSaleTime(1.3)).toBe('~1 mes');
  });

  it('shows months for values between 2 and 12', () => {
    expect(formatSaleTime(6.5)).toBe('~6.5 meses');
  });

  it('shows months and years for 12+', () => {
    const result = formatSaleTime(24);
    expect(result).toContain('24.0 meses');
    expect(result).toContain('2.0 años');
  });
});

describe('calculateWeightedAvgSaleTime', () => {
  it('returns 0 for empty array', () => {
    expect(calculateWeightedAvgSaleTime([])).toBe(0);
  });

  it('weights by quantity', () => {
    const items = [
      { quantity: 100, estimatedSaleTime: 2 }, // 100 * 2 = 200
      { quantity: 50, estimatedSaleTime: 4 }, // 50 * 4 = 200
    ];
    // Total weighted time = 400 / total quantity = 150
    expect(calculateWeightedAvgSaleTime(items)).toBeCloseTo(400 / 150, 5);
  });

  it('excludes items with Infinity sale time', () => {
    const items = [
      { quantity: 100, estimatedSaleTime: 3 },
      { quantity: 50, estimatedSaleTime: Infinity }, // Excluded
    ];
    // Only first item counts: 300 / 100 = 3
    expect(calculateWeightedAvgSaleTime(items)).toBe(3);
  });

  it('returns 0 if all items have Infinity sale time', () => {
    const items = [
      { quantity: 100, estimatedSaleTime: Infinity },
      { quantity: 50, estimatedSaleTime: Infinity },
    ];
    expect(calculateWeightedAvgSaleTime(items)).toBe(0);
  });
});

describe('calculateDiscountedPrice', () => {
  it('applies 0% discount (no change)', () => {
    expect(calculateDiscountedPrice(100, 0)).toBe(100);
  });

  it('applies 10% discount', () => {
    expect(calculateDiscountedPrice(100, 10)).toBe(90);
  });

  it('applies 50% discount', () => {
    expect(calculateDiscountedPrice(200, 50)).toBe(100);
  });

  it('applies 100% discount', () => {
    expect(calculateDiscountedPrice(100, 100)).toBe(0);
  });

  it('handles decimal prices', () => {
    expect(calculateDiscountedPrice(99.99, 10)).toBeCloseTo(89.991, 3);
  });
});

describe('calculateLineTotal', () => {
  it('calculates quantity * price with no discount', () => {
    expect(calculateLineTotal(5, 100)).toBe(500);
  });

  it('calculates quantity * price with discount', () => {
    expect(calculateLineTotal(10, 100, 20)).toBe(800);
  });

  it('returns 0 for 0 quantity', () => {
    expect(calculateLineTotal(0, 100, 10)).toBe(0);
  });

  it('handles decimal quantities', () => {
    expect(calculateLineTotal(2.5, 100, 0)).toBe(250);
  });
});

describe('calculateSubtotal', () => {
  it('sums line totals for multiple items', () => {
    const items = [
      { quantity: 2, unitPrice: 100, discountPercent: 0 },
      { quantity: 3, unitPrice: 50, discountPercent: 10 },
    ];
    // 2*100 + 3*(50*0.9) = 200 + 135 = 335
    expect(calculateSubtotal(items)).toBe(335);
  });

  it('returns 0 for empty array', () => {
    expect(calculateSubtotal([])).toBe(0);
  });

  it('handles single item', () => {
    const items = [{ quantity: 5, unitPrice: 20, discountPercent: 25 }];
    // 5 * (20 * 0.75) = 5 * 15 = 75
    expect(calculateSubtotal(items)).toBe(75);
  });
});

describe('calculateTrendDirection', () => {
  it('returns none for empty array', () => {
    expect(calculateTrendDirection([])).toBe('none');
  });

  it('returns none for single value', () => {
    expect(calculateTrendDirection([100])).toBe('none');
  });

  it('returns increasing for upward trend', () => {
    expect(calculateTrendDirection([10, 10, 50, 50])).toBe('increasing');
  });

  it('returns decreasing for downward trend', () => {
    expect(calculateTrendDirection([50, 50, 10, 10])).toBe('decreasing');
  });

  it('returns stable for flat trend', () => {
    expect(calculateTrendDirection([100, 100, 100, 100])).toBe('stable');
  });

  it('returns none for all zeros', () => {
    expect(calculateTrendDirection([0, 0, 0, 0])).toBe('none');
  });

  it('returns increasing from zero baseline', () => {
    expect(calculateTrendDirection([0, 0, 10, 10])).toBe('increasing');
  });

  it('respects custom threshold', () => {
    // 10% change with 5% threshold = increasing
    const trend = [100, 100, 111, 111];
    expect(calculateTrendDirection(trend, 5)).toBe('increasing');
    // Same trend with 20% threshold = stable
    expect(calculateTrendDirection(trend, 20)).toBe('stable');
  });
});
