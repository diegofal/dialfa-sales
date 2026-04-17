import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';
import type { ParsedCostRow } from '@/lib/utils/financialImport/types';

interface ConfirmBody {
  rows: ParsedCostRow[];
}

const COLS_PER_ROW = 8;
const CHUNK_SIZE = 500;

/**
 * Deduplicate rows by (yearMonth, source, category) key.
 * Keep the last occurrence — Postgres ON CONFLICT rejects multi-row
 * upserts that touch the same conflict target twice.
 */
function dedupeRows(rows: ParsedCostRow[]): ParsedCostRow[] {
  const map = new Map<string, ParsedCostRow>();
  for (const row of rows) {
    const key = `${row.yearMonth}|${row.source}|${row.category}`;
    map.set(key, row);
  }
  return Array.from(map.values());
}

async function upsertChunk(rows: ParsedCostRow[], userId: number | null): Promise<void> {
  if (rows.length === 0) return;

  const valueTuples: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  for (const row of rows) {
    const placeholders = Array.from({ length: COLS_PER_ROW }, () => `$${p++}`).join(', ');
    valueTuples.push(`(${placeholders}, now(), now())`);
    params.push(
      row.yearMonth,
      row.source,
      row.category,
      row.amountArs,
      row.amountUsd ?? null,
      row.exchangeRate ?? null,
      row.notes ?? null,
      userId
    );
  }

  const sql = `
    INSERT INTO monthly_costs
      (year_month, source, category, amount_ars, amount_usd, exchange_rate, notes, uploaded_by, created_at, updated_at)
    VALUES ${valueTuples.join(', ')}
    ON CONFLICT (year_month, source, category)
    DO UPDATE SET
      amount_ars = EXCLUDED.amount_ars,
      amount_usd = EXCLUDED.amount_usd,
      exchange_rate = EXCLUDED.exchange_rate,
      notes = EXCLUDED.notes,
      uploaded_by = EXCLUDED.uploaded_by,
      updated_at = now()
  `;

  await prisma.$executeRawUnsafe(sql, ...params);
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const body: ConfirmBody = await request.json();

    if (!body.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: 'No hay filas para importar' }, { status: 400 });
    }

    const userId = auth.user.userId;
    const deduped = dedupeRows(body.rows);

    // Chunk to stay safely under Postgres 65,535 parameter limit
    for (let i = 0; i < deduped.length; i += CHUNK_SIZE) {
      const chunk = deduped.slice(i, i + CHUNK_SIZE);
      await upsertChunk(chunk, userId);
    }

    return NextResponse.json({
      success: true,
      upserted: deduped.length,
      months: [...new Set(deduped.map((r) => r.yearMonth))].sort(),
    });
  } catch (error) {
    return handleError(error);
  }
}
