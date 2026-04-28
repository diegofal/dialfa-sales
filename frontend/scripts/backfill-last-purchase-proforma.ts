/**
 * Backfill articles.last_purchase_proforma_number and
 * articles.last_purchase_proforma_date from costos_unificados.NEW.csv,
 * which already records (codigo, proforma, fecha) per article.
 *
 * Default: dry-run. Pass --apply to write.
 *
 * Usage:
 *   Dry-run: npx tsx scripts/backfill-last-purchase-proforma.ts
 *   Apply:   npx tsx scripts/backfill-last-purchase-proforma.ts --apply
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const PRIMARY = 'D:\\Pedidos\\Proformas\\costos_unificados.csv';
const FALLBACK = 'D:\\Pedidos\\Proformas\\costos_unificados.NEW.csv';
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
    proforma: idx('proforma'),
    fecha: idx('fecha'),
  };

  const items = rows.slice(1).map((r) => ({
    codigo: r[I.codigo],
    descripcion: r[I.descripcion_db],
    proforma: r[I.proforma],
    fecha: r[I.fecha],
  }));
  console.log(`Loaded ${items.length} codes from CSV.`);

  // Snapshot current values BEFORE any change
  const codes = items.map((i) => i.codigo);
  const articles = await prisma.articles.findMany({
    where: { code: { in: codes }, deleted_at: null },
    select: {
      id: true,
      code: true,
      last_purchase_proforma_number: true,
      last_purchase_proforma_date: true,
    },
  });
  const currentMap = new Map<string, { id: bigint; proforma: string | null; date: Date | null }>();
  for (const a of articles) {
    currentMap.set(a.code, {
      id: a.id,
      proforma: a.last_purchase_proforma_number,
      date: a.last_purchase_proforma_date,
    });
  }

  interface Plan {
    code: string;
    description: string;
    id: bigint;
    currentProforma: string | null;
    currentDate: string | null;
    targetProforma: string;
    targetDate: string; // YYYY-MM-DD
    skipReason?: string;
  }

  const plans: Plan[] = items.map((it): Plan => {
    const cur = currentMap.get(it.codigo);
    const targetDate = it.fecha; // already YYYY-MM-DD in CSV
    const currentDateStr = cur?.date instanceof Date ? cur.date.toISOString().slice(0, 10) : null;
    let skipReason: string | undefined;
    if (!cur) {
      skipReason = 'code_not_found_in_db';
    } else if (cur.proforma === it.proforma && currentDateStr === targetDate) {
      skipReason = 'already_at_target';
    }
    return {
      code: it.codigo,
      description: it.descripcion,
      id: cur?.id ?? BigInt(0),
      currentProforma: cur?.proforma ?? null,
      currentDate: currentDateStr,
      targetProforma: it.proforma,
      targetDate,
      skipReason,
    };
  });

  const toApply = plans.filter((p) => !p.skipReason);
  const skipped = plans.filter((p) => p.skipReason);

  console.log(`\n${toApply.length} updates queued, ${skipped.length} skipped`);
  if (skipped.length > 0) {
    const reasons = new Map<string, number>();
    for (const s of skipped) {
      reasons.set(s.skipReason!, (reasons.get(s.skipReason!) ?? 0) + 1);
    }
    console.log('  skip reasons:');
    for (const [r, n] of reasons) console.log(`    ${r}: ${n}`);
  }

  // Audit log
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const auditPath = path.join(
    AUDIT_DIR,
    `audit_backfill_proforma_${ts}${apply ? '' : '_DRYRUN'}.csv`
  );
  writeCsv(
    auditPath,
    [
      'codigo',
      'descripcion',
      'proforma_antes',
      'fecha_antes',
      'proforma_despues',
      'fecha_despues',
      'estado',
      'motivo_skip',
    ],
    plans.map((p) => [
      p.code,
      p.description,
      p.currentProforma ?? '',
      p.currentDate ?? '',
      p.skipReason ? '(no change)' : p.targetProforma,
      p.skipReason ? '(no change)' : p.targetDate,
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

  console.log('\nApplying updates...');
  let updated = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const p of toApply) {
        await tx.articles.update({
          where: { id: p.id },
          data: {
            last_purchase_proforma_number: p.targetProforma,
            last_purchase_proforma_date: new Date(`${p.targetDate}T00:00:00.000Z`),
          },
        });
        updated++;
      }
    },
    { timeout: 180000 }
  );

  await prisma.$disconnect();
  console.log(`Updated ${updated} articles.`);
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await prisma.$disconnect();
  process.exit(1);
});
