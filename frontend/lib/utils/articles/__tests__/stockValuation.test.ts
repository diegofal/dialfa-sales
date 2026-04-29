import { StockStatus, StockClassificationConfig } from '@/types/stockValuation';
import {
  classifyStockStatus,
  computeCandidate,
  confirmedFor,
  isUpgrade,
  isDowngrade,
  type ClassificationSignals,
  type RecentSnapshotStatuses,
} from '../stockValuation';

const DEFAULT_CONFIG: StockClassificationConfig = {
  // Deprecated, sin efecto en la regla nueva.
  activeThresholdDays: 90,
  slowMovingThresholdDays: 180,
  deadStockThresholdDays: 365,
  minSalesForActive: 5,
  trendMonths: 6,
  includeZeroStock: false,
  // Capa 1
  minMonthsForActive: 2,
  minMonthsForLeavingDead: 2,
  deadStockNoActivityWindowMonths: 12,
  // Capa 2
  upgradeConfirmDays: 7,
  downgradeConfirmDays: 14,
  fastUpgradeMonthsThreshold: 4,
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** Helper: build a 12-month trend with sales placed at given (1-indexed, most-recent=12) months. */
function trend(salesByMonth: Record<number, number>): number[] {
  const arr = new Array(12).fill(0);
  for (const [m, q] of Object.entries(salesByMonth)) {
    const idx = parseInt(m) - 1;
    if (idx >= 0 && idx < 12) arr[idx] = q;
  }
  return arr;
}

/** Helper: history of N consecutive days all with the same status. */
function history(status: StockStatus, days: number): RecentSnapshotStatuses {
  const out: RecentSnapshotStatuses = [];
  for (let i = days; i > 0; i--) {
    out.push({ date: daysAgo(i), status });
  }
  return out;
}

describe('computeCandidate (capa 1, regla pura)', () => {
  it('returns NEVER_SOLD when stock is 0 or negative', () => {
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(10),
      daysSinceLastSale: 10,
      salesTrend: trend({ 12: 5 }),
      currentStock: 0,
    };
    expect(computeCandidate(signals, DEFAULT_CONFIG)).toBe(StockStatus.NEVER_SOLD);
    expect(computeCandidate({ ...signals, currentStock: -3 }, DEFAULT_CONFIG)).toBe(
      StockStatus.NEVER_SOLD
    );
  });

  it('returns NEVER_SOLD when there is no last sale date', () => {
    const signals: ClassificationSignals = {
      lastSaleDate: null,
      daysSinceLastSale: null,
      salesTrend: new Array(12).fill(0),
      currentStock: 100,
    };
    expect(computeCandidate(signals, DEFAULT_CONFIG)).toBe(StockStatus.NEVER_SOLD);
  });

  it('returns DEAD_STOCK when only one month of sales in last 12', () => {
    // Caso del usuario: una venta única (vieja o reciente) NO debe sacar de DEAD.
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(5),
      daysSinceLastSale: 5,
      salesTrend: trend({ 12: 10 }),
      currentStock: 100,
    };
    expect(computeCandidate(signals, DEFAULT_CONFIG)).toBe(StockStatus.DEAD_STOCK);
  });

  it('returns DEAD_STOCK for the 15-abr factura compartida pattern', () => {
    // Una factura de hace 6 meses agrupó varios artículos. Cada uno tiene
    // 1 mes con ventas en últimos 12 → DEAD.
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(180),
      daysSinceLastSale: 180,
      salesTrend: trend({ 6: 12 }),
      currentStock: 50,
    };
    expect(computeCandidate(signals, DEFAULT_CONFIG)).toBe(StockStatus.DEAD_STOCK);
  });

  it('returns ACTIVE for B2B slow-but-recurring (caso BCS1504)', () => {
    // m3=2 (de los últimos 3, dos tuvieron ventas), m6 alto, recencia OK.
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(12),
      daysSinceLastSale: 12,
      salesTrend: trend({ 12: 5, 11: 3, 10: 2, 9: 0, 8: 0, 7: 4 }),
      currentStock: 30,
    };
    expect(computeCandidate(signals, DEFAULT_CONFIG)).toBe(StockStatus.ACTIVE);
  });

  it('returns SLOW_MOVING when activity is recurrent but recency is poor', () => {
    // m12 >= 2 (no es dead), pero la última venta es vieja → no califica para active.
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(120),
      daysSinceLastSale: 120,
      salesTrend: trend({ 8: 5, 9: 3, 10: 2 }),
      currentStock: 30,
    };
    expect(computeCandidate(signals, DEFAULT_CONFIG)).toBe(StockStatus.SLOW_MOVING);
  });

  it('returns SLOW_MOVING when recency OK but only 1 of last 3 months has sales', () => {
    // m12 >= 2 (escapa dead), recency OK, pero m3 = 1 → no califica para active.
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(5),
      daysSinceLastSale: 5,
      salesTrend: trend({ 12: 8, 5: 3 }),
      currentStock: 30,
    };
    expect(computeCandidate(signals, DEFAULT_CONFIG)).toBe(StockStatus.SLOW_MOVING);
  });
});

describe('classifyStockStatus (capa 1 + histéresis)', () => {
  it('first run (previousStatus=null) accepts the candidate as-is', () => {
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(12),
      daysSinceLastSale: 12,
      salesTrend: trend({ 12: 5, 11: 3, 10: 2 }),
      currentStock: 30,
    };
    expect(classifyStockStatus(signals, null, [], DEFAULT_CONFIG)).toBe(StockStatus.ACTIVE);
  });

  it('blocks dead → slow upgrade until candidate is sustained for upgradeConfirmDays', () => {
    // El artículo vendió hoy una sola vez después de mucho. La regla de capa 1
    // todavía dice DEAD (m12 < 2) — pero supongamos que la regla diera SLOW
    // por algún cambio de signal. La capa 2 debería retener DEAD hasta confirmación.
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(5),
      daysSinceLastSale: 5,
      salesTrend: trend({ 12: 5, 6: 2 }),
      currentStock: 30,
    };
    // candidate = SLOW_MOVING (m12=2, recency OK pero m3=1)
    expect(computeCandidate(signals, DEFAULT_CONFIG)).toBe(StockStatus.SLOW_MOVING);

    // Sólo 3 días de candidate=SLOW_MOVING tras estar en DEAD → no confirma (necesita 7).
    const recentDays3 = history(StockStatus.SLOW_MOVING, 3);
    expect(classifyStockStatus(signals, StockStatus.DEAD_STOCK, recentDays3, DEFAULT_CONFIG)).toBe(
      StockStatus.DEAD_STOCK
    );

    // 7 días sostenidos → confirma.
    const recentDays7 = history(StockStatus.SLOW_MOVING, 7);
    expect(classifyStockStatus(signals, StockStatus.DEAD_STOCK, recentDays7, DEFAULT_CONFIG)).toBe(
      StockStatus.SLOW_MOVING
    );
  });

  it('blocks active → slow downgrade until sustained for downgradeConfirmDays', () => {
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(120),
      daysSinceLastSale: 120,
      salesTrend: trend({ 8: 5, 9: 3, 10: 2 }),
      currentStock: 30,
    };
    // candidate = SLOW_MOVING (recency > 90)
    expect(computeCandidate(signals, DEFAULT_CONFIG)).toBe(StockStatus.SLOW_MOVING);

    // 10 días de slow tras active → todavía bajo el umbral de 14.
    const recent10 = history(StockStatus.SLOW_MOVING, 10);
    expect(classifyStockStatus(signals, StockStatus.ACTIVE, recent10, DEFAULT_CONFIG)).toBe(
      StockStatus.ACTIVE
    );

    // 14 días → confirma el downgrade.
    const recent14 = history(StockStatus.SLOW_MOVING, 14);
    expect(classifyStockStatus(signals, StockStatus.ACTIVE, recent14, DEFAULT_CONFIG)).toBe(
      StockStatus.SLOW_MOVING
    );
  });

  it('escape hatch: strong upgrade (m6 >= fastUpgradeMonthsThreshold) skips confirmation', () => {
    // 4 meses con ventas en últimos 6 → upgrade inmediato sin esperar 7 días.
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(5),
      daysSinceLastSale: 5,
      salesTrend: trend({ 12: 5, 11: 3, 10: 2, 9: 4, 8: 1 }),
      currentStock: 30,
    };
    // candidate = ACTIVE (m3 = 3, recency OK)
    expect(computeCandidate(signals, DEFAULT_CONFIG)).toBe(StockStatus.ACTIVE);

    // No hace falta historia: el escape hatch dispara igual.
    expect(classifyStockStatus(signals, StockStatus.SLOW_MOVING, [], DEFAULT_CONFIG)).toBe(
      StockStatus.ACTIVE
    );
  });

  it('does not flip-flop on a single sale that returns to the prior status one day later', () => {
    // Caso US3SW1/2 simplificado: artículo active, un mes flojo lo lleva a slow,
    // pero el siguiente mes vuelve. Sin histéresis se vería como flip-flop.
    // Acá: un solo día de candidate=SLOW tras estar ACTIVE no debe bajarlo.
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(95),
      daysSinceLastSale: 95,
      salesTrend: trend({ 12: 5, 11: 3, 10: 2, 9: 0, 8: 0, 7: 4 }),
      currentStock: 30,
    };
    // candidate = SLOW (recency 95 > 90)
    expect(computeCandidate(signals, DEFAULT_CONFIG)).toBe(StockStatus.SLOW_MOVING);
    const oneDay = history(StockStatus.SLOW_MOVING, 1);
    expect(classifyStockStatus(signals, StockStatus.ACTIVE, oneDay, DEFAULT_CONFIG)).toBe(
      StockStatus.ACTIVE
    );
  });

  it('keeps state when candidate matches previous (no transition needed)', () => {
    const signals: ClassificationSignals = {
      lastSaleDate: daysAgo(400),
      daysSinceLastSale: 400,
      salesTrend: new Array(12).fill(0),
      currentStock: 30,
    };
    expect(classifyStockStatus(signals, StockStatus.DEAD_STOCK, [], DEFAULT_CONFIG)).toBe(
      StockStatus.DEAD_STOCK
    );
  });
});

describe('confirmedFor', () => {
  it('returns false when history is shorter than required', () => {
    expect(confirmedFor(StockStatus.SLOW_MOVING, history(StockStatus.SLOW_MOVING, 5), 7)).toBe(
      false
    );
  });

  it('returns true when last N days all match target', () => {
    expect(confirmedFor(StockStatus.SLOW_MOVING, history(StockStatus.SLOW_MOVING, 7), 7)).toBe(
      true
    );
  });

  it('returns false when there is a non-matching status within last N days', () => {
    const recent: RecentSnapshotStatuses = [
      { date: daysAgo(7), status: StockStatus.SLOW_MOVING },
      { date: daysAgo(6), status: StockStatus.SLOW_MOVING },
      { date: daysAgo(5), status: StockStatus.SLOW_MOVING },
      { date: daysAgo(4), status: StockStatus.DEAD_STOCK }, // not target
      { date: daysAgo(3), status: StockStatus.SLOW_MOVING },
      { date: daysAgo(2), status: StockStatus.SLOW_MOVING },
      { date: daysAgo(1), status: StockStatus.SLOW_MOVING },
    ];
    expect(confirmedFor(StockStatus.SLOW_MOVING, recent, 7)).toBe(false);
  });

  it('counts days with snapshot, not calendar days (tolerates cron gaps)', () => {
    // 7 snapshots presentes (aunque sean de días no consecutivos por calendario).
    const recent: RecentSnapshotStatuses = [
      { date: daysAgo(20), status: StockStatus.SLOW_MOVING },
      { date: daysAgo(15), status: StockStatus.SLOW_MOVING },
      { date: daysAgo(13), status: StockStatus.SLOW_MOVING },
      { date: daysAgo(10), status: StockStatus.SLOW_MOVING },
      { date: daysAgo(8), status: StockStatus.SLOW_MOVING },
      { date: daysAgo(5), status: StockStatus.SLOW_MOVING },
      { date: daysAgo(1), status: StockStatus.SLOW_MOVING },
    ];
    expect(confirmedFor(StockStatus.SLOW_MOVING, recent, 7)).toBe(true);
  });
});

describe('isUpgrade / isDowngrade', () => {
  it('correctly orders the 4 statuses by severity', () => {
    expect(isUpgrade(StockStatus.DEAD_STOCK, StockStatus.SLOW_MOVING)).toBe(true);
    expect(isUpgrade(StockStatus.SLOW_MOVING, StockStatus.ACTIVE)).toBe(true);
    expect(isUpgrade(StockStatus.NEVER_SOLD, StockStatus.DEAD_STOCK)).toBe(true);
    expect(isDowngrade(StockStatus.ACTIVE, StockStatus.SLOW_MOVING)).toBe(true);
    expect(isDowngrade(StockStatus.SLOW_MOVING, StockStatus.DEAD_STOCK)).toBe(true);
    expect(isUpgrade(StockStatus.ACTIVE, StockStatus.ACTIVE)).toBe(false);
    expect(isDowngrade(StockStatus.ACTIVE, StockStatus.ACTIVE)).toBe(false);
  });
});
