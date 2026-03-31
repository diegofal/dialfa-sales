import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { StockSnapshot } from '@/types/stockSnapshot';

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
