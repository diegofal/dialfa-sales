import { StockStatus } from '@/types/stockValuation';
import { getTransitions } from '../StockSnapshotService';

const mockQueryRaw = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

const D_START = new Date('2026-04-02T00:00:00.000Z');
const D_END = new Date('2026-05-04T00:00:00.000Z');

function makeTransitionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    article_id: '1',
    article_code: 'A1',
    description: 'Article 1',
    status_from: StockStatus.SLOW_MOVING,
    status_to: StockStatus.ACTIVE,
    transition_date: '2026-04-30',
    stock: '100',
    unit_value: '10',
    stock_value: '1000',
    ...overrides,
  };
}

describe('getTransitions', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('returns matrix, transitions and totalsByDirection for an upgrade and a downgrade', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        makeTransitionRow({
          article_id: '1',
          article_code: 'CRL908',
          status_from: StockStatus.SLOW_MOVING,
          status_to: StockStatus.ACTIVE,
          stock_value: '19167.28',
        }),
        makeTransitionRow({
          article_id: '2',
          article_code: 'C14',
          status_from: StockStatus.SLOW_MOVING,
          status_to: StockStatus.DEAD_STOCK,
          stock_value: '1350.82',
        }),
        makeTransitionRow({
          article_id: '3',
          article_code: 'E1/2X31/2',
          status_from: StockStatus.DEAD_STOCK,
          status_to: StockStatus.ACTIVE,
          stock_value: '1831.56',
        }),
      ])
      .mockResolvedValueOnce([{ d_start: D_START, d_end: D_END }]);

    const result = await getTransitions(D_START, D_END);

    expect(result.transitions).toHaveLength(3);
    expect(result.matrix).toHaveLength(3);
    expect(result.totalsByDirection).toEqual({ upgrades: 2, downgrades: 1, sideways: 0 });
    expect(result.actualFromDate).toBe('2026-04-02');
    expect(result.actualToDate).toBe('2026-05-04');

    const slowToActive = result.matrix.find(
      (c) => c.fromStatus === StockStatus.SLOW_MOVING && c.toStatus === StockStatus.ACTIVE
    );
    expect(slowToActive).toMatchObject({ count: 1, totalStockValue: 19167.28 });

    const slowToDead = result.matrix.find(
      (c) => c.fromStatus === StockStatus.SLOW_MOVING && c.toStatus === StockStatus.DEAD_STOCK
    );
    expect(slowToDead).toMatchObject({ count: 1, totalStockValue: 1350.82 });
  });

  it('aggregates matrix counts when multiple articles share the same transition', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        makeTransitionRow({ article_id: '1', stock_value: '100' }),
        makeTransitionRow({ article_id: '2', stock_value: '200' }),
        makeTransitionRow({ article_id: '3', stock_value: '300' }),
      ])
      .mockResolvedValueOnce([{ d_start: D_START, d_end: D_END }]);

    const result = await getTransitions(D_START, D_END);

    expect(result.matrix).toHaveLength(1);
    expect(result.matrix[0]).toMatchObject({
      fromStatus: StockStatus.SLOW_MOVING,
      toStatus: StockStatus.ACTIVE,
      count: 3,
      totalStockValue: 600,
    });
    expect(result.totalsByDirection.upgrades).toBe(3);
  });

  it('classifies transitions involving NEVER_SOLD as sideways', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        makeTransitionRow({
          status_from: StockStatus.NEVER_SOLD,
          status_to: StockStatus.ACTIVE,
        }),
      ])
      .mockResolvedValueOnce([{ d_start: D_START, d_end: D_END }]);

    const result = await getTransitions(D_START, D_END);

    expect(result.totalsByDirection).toEqual({ upgrades: 0, downgrades: 0, sideways: 1 });
  });

  it('filters transitions list by fromStatus / toStatus / minStockValue / limit', async () => {
    const rows = [
      makeTransitionRow({
        article_id: '1',
        status_from: StockStatus.SLOW_MOVING,
        status_to: StockStatus.ACTIVE,
        stock_value: '5000',
      }),
      makeTransitionRow({
        article_id: '2',
        status_from: StockStatus.SLOW_MOVING,
        status_to: StockStatus.ACTIVE,
        stock_value: '500',
      }),
      makeTransitionRow({
        article_id: '3',
        status_from: StockStatus.DEAD_STOCK,
        status_to: StockStatus.ACTIVE,
        stock_value: '10000',
      }),
    ];

    mockQueryRaw
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([{ d_start: D_START, d_end: D_END }]);

    const result = await getTransitions(D_START, D_END, {
      fromStatus: StockStatus.SLOW_MOVING,
      minStockValue: 1000,
      limit: 1,
    });

    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].articleId).toBe('1');
    // Matrix and totals should NOT be affected by list filters.
    expect(result.matrix.reduce((acc, c) => acc + c.count, 0)).toBe(3);
    expect(result.totalsByDirection.upgrades).toBe(3);
  });

  it('returns null actual dates when no snapshots exist in the window', async () => {
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ d_start: null, d_end: null }]);

    const result = await getTransitions(D_START, D_END);

    expect(result.transitions).toHaveLength(0);
    expect(result.matrix).toHaveLength(0);
    expect(result.actualFromDate).toBeNull();
    expect(result.actualToDate).toBeNull();
    expect(result.totalsByDirection).toEqual({ upgrades: 0, downgrades: 0, sideways: 0 });
  });

  it('preserves requestedFromDate and requestedToDate even when bounds shift', async () => {
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        d_start: new Date('2026-04-05T00:00:00.000Z'),
        d_end: new Date('2026-05-03T00:00:00.000Z'),
      },
    ]);

    const result = await getTransitions(D_START, D_END);

    expect(result.requestedFromDate).toBe('2026-04-02');
    expect(result.requestedToDate).toBe('2026-05-04');
    expect(result.actualFromDate).toBe('2026-04-05');
    expect(result.actualToDate).toBe('2026-05-03');
  });
});
