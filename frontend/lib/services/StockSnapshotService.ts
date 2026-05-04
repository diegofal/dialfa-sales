import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { calculateStockValuation } from '@/lib/utils/articles/stockValuation';
import {
  StockSnapshot,
  StockCategorySnapshotsByStatus,
  ArticleMovement,
} from '@/types/stockSnapshot';
import {
  ArticleTransition,
  GetTransitionsOptions,
  StockTransitionsResult,
  TransitionMatrixCell,
} from '@/types/stockTransitions';
import { StockStatus, StockValuationSummary } from '@/types/stockValuation';

/**
 * Creates a daily stock value snapshot.
 * Idempotent: only one snapshot per calendar day (UTC).
 */
export async function createSnapshot(): Promise<StockSnapshot> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  const existing = await prisma.stock_snapshots.findFirst({
    where: {
      date: { gte: todayStart, lte: todayEnd },
    },
  });

  if (existing) {
    return formatSnapshot(existing);
  }

  const result = await prisma.$queryRaw<[{ total_value: Prisma.Decimal }]>`
    SELECT COALESCE(SUM(stock * unit_price), 0) as total_value
    FROM articles
    WHERE deleted_at IS NULL AND stock > 0
  `;

  const totalValue = result[0].total_value;

  const snapshot = await prisma.stock_snapshots.create({
    data: {
      date: new Date(),
      stock_value: totalValue,
    },
  });

  return formatSnapshot(snapshot);
}

/**
 * Retrieves stock snapshots for the last N months.
 */
export async function getSnapshots(months = 12): Promise<StockSnapshot[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const snapshots = await prisma.stock_snapshots.findMany({
    where: {
      date: { gte: since },
    },
    orderBy: { date: 'asc' },
  });

  return snapshots.map(formatSnapshot);
}

function formatSnapshot(snapshot: {
  id: bigint | bigint;
  date: Date;
  stock_value: Prisma.Decimal;
  created_at: Date;
}): StockSnapshot {
  const value = Number(snapshot.stock_value);
  return {
    id: snapshot.id.toString(),
    date: snapshot.date.toISOString(),
    stockValue: value,
    formattedDate: snapshot.date.toISOString().split('T')[0],
    formattedValue: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value),
  };
}

/**
 * Creates daily stock category snapshots.
 * Idempotent: upserts one record per status per calendar day (UTC).
 */
export async function createCategorySnapshots(
  precomputedValuation?: StockValuationSummary
): Promise<void> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const valuation = precomputedValuation ?? (await calculateStockValuation());

  const statuses = [
    StockStatus.ACTIVE,
    StockStatus.SLOW_MOVING,
    StockStatus.DEAD_STOCK,
    StockStatus.NEVER_SOLD,
  ];

  for (const status of statuses) {
    const statusData = valuation.byStatus[status];
    await prisma.stock_category_snapshots.upsert({
      where: {
        date_status: {
          date: todayStart,
          status,
        },
      },
      update: {
        count: statusData.count,
        total_value: new Prisma.Decimal(statusData.totalValueAtListPrice.toFixed(2)),
      },
      create: {
        date: todayStart,
        status,
        count: statusData.count,
        total_value: new Prisma.Decimal(statusData.totalValueAtListPrice.toFixed(2)),
      },
    });
  }
}

/**
 * Creates daily per-article status snapshots.
 * Idempotent: only creates records if today's snapshots don't exist yet.
 */
export async function createArticleStatusSnapshots(
  precomputedValuation?: StockValuationSummary
): Promise<void> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.article_status_snapshots.findFirst({
    where: { date: todayStart },
    select: { id: true },
  });
  if (existing) return;

  const valuation = precomputedValuation ?? (await calculateStockValuation());

  const statuses = [
    StockStatus.ACTIVE,
    StockStatus.SLOW_MOVING,
    StockStatus.DEAD_STOCK,
    StockStatus.NEVER_SOLD,
  ];

  const records: Array<{
    date: Date;
    article_id: bigint;
    article_code: string;
    status: string;
  }> = [];

  for (const status of statuses) {
    for (const article of valuation.byStatus[status].articles) {
      records.push({
        date: todayStart,
        article_id: BigInt(article.articleId),
        article_code: article.articleCode,
        status,
      });
    }
  }

  if (records.length === 0) return;

  await prisma.article_status_snapshots.createMany({
    data: records,
    skipDuplicates: true,
  });
}

// `getRecentArticleStatuses` is defined in `lib/utils/articles/stockValuation.ts`
// because it's consumed by the classifier (defining it here would create a
// circular dependency: StockSnapshotService already imports from
// stockValuation). It's re-exported below for external callers that look here.
export { getRecentArticleStatuses } from '@/lib/utils/articles/stockValuation';

/**
 * Retrieves stock category snapshots for the last N months, grouped by status.
 * Also computes article movements (entered/exited) between consecutive days
 * by comparing per-article status snapshots.
 */
export async function getCategorySnapshots(months = 6): Promise<StockCategorySnapshotsByStatus> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const [snapshots, articleSnapshots] = await Promise.all([
    prisma.stock_category_snapshots.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
    }),
    prisma.article_status_snapshots.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, article_code: true, status: true },
    }),
  ]);

  // Build: dateStr -> status -> Set<article_code>
  const articlesByDateStatus = new Map<string, Map<string, Set<string>>>();
  for (const snap of articleSnapshots) {
    const dateStr = snap.date.toISOString().split('T')[0];
    let statusMap = articlesByDateStatus.get(dateStr);
    if (!statusMap) {
      statusMap = new Map();
      articlesByDateStatus.set(dateStr, statusMap);
    }
    let codeSet = statusMap.get(snap.status);
    if (!codeSet) {
      codeSet = new Set();
      statusMap.set(snap.status, codeSet);
    }
    codeSet.add(snap.article_code);
  }

  const result: StockCategorySnapshotsByStatus = {};

  for (const snap of snapshots) {
    if (!result[snap.status]) {
      result[snap.status] = { dates: [], counts: [], values: [], movements: [] };
    }
    const dateStr = snap.date.toISOString().split('T')[0];
    const statusEntry = result[snap.status];
    statusEntry.dates.push(dateStr);
    statusEntry.counts.push(snap.count);
    statusEntry.values.push(Number(snap.total_value));

    const currentSet = articlesByDateStatus.get(dateStr)?.get(snap.status) ?? new Set<string>();
    let movement: ArticleMovement;

    if (statusEntry.dates.length === 1) {
      movement = { entered: [], exited: [] };
    } else {
      const prevDateStr = statusEntry.dates[statusEntry.dates.length - 2];
      const prevSet = articlesByDateStatus.get(prevDateStr)?.get(snap.status) ?? new Set<string>();
      const entered: string[] = [];
      const exited: string[] = [];
      for (const code of currentSet) {
        if (!prevSet.has(code)) entered.push(code);
      }
      for (const code of prevSet) {
        if (!currentSet.has(code)) exited.push(code);
      }
      movement = { entered, exited };
    }
    statusEntry.movements!.push(movement);
  }

  return result;
}

/**
 * Ordering used to classify a transition as "upgrade" or "downgrade".
 * NEVER_SOLD sits outside the active/slow/dead spectrum and is treated as sideways.
 */
const STATUS_RANK: Record<string, number> = {
  [StockStatus.DEAD_STOCK]: 0,
  [StockStatus.SLOW_MOVING]: 1,
  [StockStatus.ACTIVE]: 2,
};

interface TransitionRow {
  article_id: string;
  article_code: string;
  description: string | null;
  status_from: string;
  status_to: string;
  transition_date: string | null;
  stock: string | null;
  unit_value: string | null;
  stock_value: string | null;
  units_out: number | null;
  units_in: number | null;
  movement_count: number | null;
}

/**
 * Returns net status transitions over a date window, comparing the first and
 * last available `article_status_snapshots` rows inside [fromDate, toDate].
 *
 * Returns the transition matrix (origin × destination), the per-article list,
 * and aggregate totals by direction. Snapshot dates are inclusive; if no
 * snapshot exists exactly on the bounds, the closest snapshot inside the range
 * is used.
 */
export async function getTransitions(
  fromDate: Date,
  toDate: Date,
  options: GetTransitionsOptions = {}
): Promise<StockTransitionsResult> {
  const requestedFromDate = fromDate.toISOString().split('T')[0];
  const requestedToDate = toDate.toISOString().split('T')[0];

  const rows = await prisma.$queryRaw<TransitionRow[]>`
    WITH bounds AS (
      SELECT
        (SELECT MIN(date) FROM article_status_snapshots WHERE date >= ${fromDate}) AS d_start,
        (SELECT MAX(date) FROM article_status_snapshots WHERE date <= ${toDate}) AS d_end
    ),
    first_state AS (
      SELECT a.article_id, a.article_code, a.status AS status_from
      FROM article_status_snapshots a, bounds b
      WHERE a.date = b.d_start
    ),
    last_state AS (
      SELECT a.article_id, a.status AS status_to
      FROM article_status_snapshots a, bounds b
      WHERE a.date = b.d_end
    ),
    changed AS (
      SELECT f.article_id, f.article_code, f.status_from, l.status_to
      FROM first_state f
      INNER JOIN last_state l ON f.article_id = l.article_id
      WHERE f.status_from <> l.status_to
    ),
    transition_dates AS (
      SELECT a.article_id, MIN(a.date) AS reached_at
      FROM article_status_snapshots a
      INNER JOIN changed c
        ON c.article_id = a.article_id AND c.status_to = a.status
      WHERE a.date BETWEEN (SELECT d_start FROM bounds) AND (SELECT d_end FROM bounds)
      GROUP BY a.article_id
    ),
    movements_in_window AS (
      SELECT
        sm.article_id,
        SUM(CASE WHEN sm.movement_type = 2 THEN sm.quantity ELSE 0 END)::int AS units_out,
        SUM(CASE WHEN sm.movement_type = 1 THEN sm.quantity ELSE 0 END)::int AS units_in,
        COUNT(*)::int AS movement_count
      FROM stock_movements sm
      INNER JOIN changed c ON c.article_id = sm.article_id
      WHERE sm.movement_date >= (SELECT d_start FROM bounds)
        AND sm.movement_date < (SELECT d_end FROM bounds) + INTERVAL '1 day'
        AND sm.deleted_at IS NULL
      GROUP BY sm.article_id
    )
    SELECT
      c.article_id::text AS article_id,
      c.article_code,
      ar.description,
      c.status_from,
      c.status_to,
      td.reached_at::date::text AS transition_date,
      ar.stock::text AS stock,
      COALESCE(ar.last_purchase_price, ar.cost_price, ar.unit_price, 0)::text AS unit_value,
      (ar.stock * COALESCE(ar.last_purchase_price, ar.cost_price, ar.unit_price, 0))::text AS stock_value,
      COALESCE(mw.units_out, 0)::int AS units_out,
      COALESCE(mw.units_in, 0)::int AS units_in,
      COALESCE(mw.movement_count, 0)::int AS movement_count
    FROM changed c
    LEFT JOIN articles ar ON ar.id = c.article_id
    LEFT JOIN transition_dates td ON td.article_id = c.article_id
    LEFT JOIN movements_in_window mw ON mw.article_id = c.article_id
    ORDER BY (ar.stock * COALESCE(ar.last_purchase_price, ar.cost_price, ar.unit_price, 0)) DESC NULLS LAST
  `;

  const boundsRows = await prisma.$queryRaw<{ d_start: Date | null; d_end: Date | null }[]>`
    SELECT
      (SELECT MIN(date) FROM article_status_snapshots WHERE date >= ${fromDate}) AS d_start,
      (SELECT MAX(date) FROM article_status_snapshots WHERE date <= ${toDate}) AS d_end
  `;
  const actualFromDate = boundsRows[0]?.d_start
    ? boundsRows[0].d_start.toISOString().split('T')[0]
    : null;
  const actualToDate = boundsRows[0]?.d_end
    ? boundsRows[0].d_end.toISOString().split('T')[0]
    : null;

  const allTransitions: ArticleTransition[] = rows.map((r) => ({
    articleId: r.article_id,
    articleCode: r.article_code,
    description: r.description,
    fromStatus: r.status_from as StockStatus,
    toStatus: r.status_to as StockStatus,
    transitionDate: r.transition_date,
    currentStock: r.stock ? Number(r.stock) : 0,
    unitValue: r.unit_value ? Number(r.unit_value) : 0,
    stockValue: r.stock_value ? Number(r.stock_value) : 0,
    unitsOut: r.units_out ?? 0,
    unitsIn: r.units_in ?? 0,
    movementCount: r.movement_count ?? 0,
  }));

  const matrixMap = new Map<string, TransitionMatrixCell>();
  for (const t of allTransitions) {
    const key = `${t.fromStatus}|${t.toStatus}`;
    const cell = matrixMap.get(key);
    if (cell) {
      cell.count += 1;
      cell.totalStockValue += t.stockValue;
    } else {
      matrixMap.set(key, {
        fromStatus: t.fromStatus,
        toStatus: t.toStatus,
        count: 1,
        totalStockValue: t.stockValue,
      });
    }
  }
  const matrix = Array.from(matrixMap.values());

  const totalsByDirection = { upgrades: 0, downgrades: 0, sideways: 0 };
  for (const t of allTransitions) {
    const fromRank = STATUS_RANK[t.fromStatus];
    const toRank = STATUS_RANK[t.toStatus];
    if (fromRank === undefined || toRank === undefined) {
      totalsByDirection.sideways += 1;
    } else if (toRank > fromRank) {
      totalsByDirection.upgrades += 1;
    } else if (toRank < fromRank) {
      totalsByDirection.downgrades += 1;
    } else {
      totalsByDirection.sideways += 1;
    }
  }

  let filtered = allTransitions;
  if (options.fromStatus) {
    filtered = filtered.filter((t) => t.fromStatus === options.fromStatus);
  }
  if (options.toStatus) {
    filtered = filtered.filter((t) => t.toStatus === options.toStatus);
  }
  if (typeof options.minStockValue === 'number') {
    const min = options.minStockValue;
    filtered = filtered.filter((t) => t.stockValue >= min);
  }
  if (typeof options.limit === 'number' && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return {
    requestedFromDate,
    requestedToDate,
    actualFromDate,
    actualToDate,
    matrix,
    transitions: filtered,
    totalsByDirection,
  };
}
