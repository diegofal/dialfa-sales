/**
 * Update articles.last_purchase_price with proforma_max_price for codes
 * where the comparison flagged a difference.
 *
 * Default: dry-run (no writes). Pass --apply to actually update.
 *
 * Usage:
 *   Dry-run:  npx tsx scripts/update-last-purchase-prices.ts
 *   Apply:    npx tsx scripts/update-last-purchase-prices.ts --apply
 *
 * Always writes an audit log: D:\Pedidos\Proformas\audit_update_prices_{ts}.csv
 * with before/after values, so the change can be rolled back if needed.
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const PRIMARY = 'D:\\Pedidos\\Proformas\\comparacion_precios_proforma_vs_db.csv';
const FALLBACK = 'D:\\Pedidos\\Proformas\\comparacion_precios_proforma_vs_db.NEW.csv';
const AUDIT_DIR = 'D:\\Pedidos\\Proformas';

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

function pickInput(): string {
  if (fs.existsSync(FALLBACK)) {
    if (!fs.existsSync(PRIMARY) || fs.statSync(FALLBACK).mtimeMs > fs.statSync(PRIMARY).mtimeMs) {
      return FALLBACK;
    }
  }
  return PRIMARY;
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let atFieldStart = true;
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"' && atFieldStart) {
        inQuotes = true;
        atFieldStart = false;
        i++;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        atFieldStart = true;
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field);
        field = '';
        atFieldStart = true;
        if (row.some((c) => c.trim())) rows.push(row);
        row = [];
        if (ch === '\r' && content[i + 1] === '\n') i += 2;
        else i++;
      } else {
        field += ch;
        atFieldStart = false;
        i++;
      }
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim())) rows.push(row);
  }
  return rows;
}

function escapeCsv(v: string | number): string {
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv(filePath: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsv).join(','));
  fs.writeFileSync(filePath, '﻿' + lines.join('\r\n') + '\r\n');
}

async function main(): Promise<void> {
  console.log(apply ? '*** APPLY MODE — writes will be committed ***' : '[DRY RUN] no DB writes');
  console.log();

  const inputPath = pickInput();
  console.log(`Reading ${inputPath}...`);
  const raw = stripBom(fs.readFileSync(inputPath, 'utf-8'));
  const rows = parseCsv(raw);
  const header = rows[0].map((h) => h.toLowerCase());
  const idx = (c: string): number => {
    const i = header.indexOf(c);
    if (i < 0) throw new Error(`column missing: ${c}`);
    return i;
  };
  const I = {
    codigo: idx('codigo'),
    descripcion_db: idx('descripcion_db'),
    proforma_max_price: idx('proforma_max_price'),
    db_last_purchase_price: idx('db_last_purchase_price'),
    status: idx('status'),
    proforma: idx('proforma'),
    fecha: idx('fecha'),
  };

  // Update both 'different' (price mismatch) and 'db_null' (DB has no recorded
  // purchase price). 'equal' obviously doesn't need updating; 'not_found'
  // means the article doesn't exist in DB so we can't update.
  const diffs = rows
    .slice(1)
    .filter((r) => r[I.status] === 'different' || r[I.status] === 'db_null');
  console.log(`Found ${diffs.length} items needing update (different + db_null).`);

  // Sanity check: re-fetch CURRENT last_purchase_price from DB
  // before updating, in case it changed since the comparison was run.
  const codes = diffs.map((r) => r[I.codigo]);
  const currentArticles = await prisma.articles.findMany({
    where: { code: { in: codes }, deleted_at: null },
    select: { id: true, code: true, last_purchase_price: true },
  });
  const currentById = new Map<string, { id: bigint; current: number | null }>();
  for (const a of currentArticles) {
    currentById.set(a.code, {
      id: a.id,
      current: a.last_purchase_price === null ? null : parseFloat(a.last_purchase_price.toString()),
    });
  }

  // Build the update plan, skipping any whose current DB price already
  // equals the proforma price (someone else updated it; nothing to do).
  interface Plan {
    code: string;
    description: string;
    id: bigint;
    csvDbPrice: number;
    currentDbPrice: number | null;
    targetPrice: number; // = proforma_max_price, rounded to 2 decimals (Decimal(12,2))
    proforma: string;
    fecha: string;
    skipReason?: string;
  }

  const plans: Plan[] = diffs.map((r): Plan => {
    const code = r[I.codigo];
    const cur = currentById.get(code);
    const csvDb = parseFloat(r[I.db_last_purchase_price]);
    const proformaPrice = parseFloat(r[I.proforma_max_price]);
    const target = Math.round(proformaPrice * 100) / 100; // 2-decimal column

    let skipReason: string | undefined;
    if (!cur) {
      skipReason = 'code_not_found_in_db';
    } else if (cur.current !== null && Math.abs(cur.current - target) < 0.005) {
      skipReason = 'already_at_target';
    } else if (cur.current !== null && Math.abs(cur.current - csvDb) > 0.01) {
      skipReason = `db_changed_since_csv (csv=${csvDb}, now=${cur.current})`;
    }

    return {
      code,
      description: r[I.descripcion_db],
      id: cur?.id ?? BigInt(0),
      csvDbPrice: csvDb,
      currentDbPrice: cur?.current ?? null,
      targetPrice: target,
      proforma: r[I.proforma],
      fecha: r[I.fecha],
      skipReason,
    };
  });

  const toApply = plans.filter((p) => !p.skipReason);
  const skipped = plans.filter((p) => p.skipReason);

  console.log(`\n${toApply.length} updates queued, ${skipped.length} skipped`);
  if (skipped.length > 0) {
    const reasons = new Map<string, number>();
    for (const s of skipped) {
      const k = s.skipReason!.split(' ')[0];
      reasons.set(k, (reasons.get(k) ?? 0) + 1);
    }
    console.log('  skip reasons:');
    for (const [r, n] of reasons) console.log(`    ${r}: ${n}`);
  }

  // Always write an audit log (so dry-run also produces a preview file)
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const auditPath = path.join(AUDIT_DIR, `audit_update_prices_${ts}${apply ? '' : '_DRYRUN'}.csv`);
  writeCsv(
    auditPath,
    [
      'codigo',
      'descripcion',
      'last_purchase_price_antes_USD',
      'last_purchase_price_despues_USD',
      'delta_USD',
      'proforma_origen',
      'fecha_origen',
      'estado',
      'motivo_skip',
    ],
    plans.map((p) => [
      p.code,
      p.description,
      p.currentDbPrice === null ? '' : p.currentDbPrice.toFixed(2),
      p.skipReason ? '(no change)' : p.targetPrice.toFixed(2),
      p.skipReason || p.currentDbPrice === null
        ? ''
        : (p.targetPrice - p.currentDbPrice).toFixed(2),
      p.proforma,
      p.fecha,
      p.skipReason ? 'skipped' : apply ? 'applied' : 'pending',
      p.skipReason ?? '',
    ])
  );
  console.log(`\nAudit log: ${auditPath}`);

  if (!apply) {
    console.log('\n[DRY RUN] No changes written. Run with --apply to commit.');
    await prisma.$disconnect();
    return;
  }

  // APPLY: do the updates inside a transaction (atomic — all-or-nothing)
  console.log('\nApplying updates...');
  let updated = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const p of toApply) {
        await tx.articles.update({
          where: { id: p.id },
          data: { last_purchase_price: p.targetPrice },
        });
        updated++;
      }
    },
    { timeout: 120000 }
  );

  await prisma.$disconnect();

  console.log(`Updated ${updated} articles.`);
  console.log(`Audit log: ${auditPath}`);
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
