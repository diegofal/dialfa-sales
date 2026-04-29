import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { calculateStockValuation } from '@/lib/utils/articles/stockValuation';
import {
  StockSnapshot,
  StockCategorySnapshotsByStatus,
  ArticleMovement,
} from '@/types/stockSnapshot';
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
