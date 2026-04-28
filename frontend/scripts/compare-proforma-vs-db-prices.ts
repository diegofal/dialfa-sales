/**
 * Compare consolidated proforma max prices against articles.last_purchase_price in DB.
 *
 * Reads costos_unificados.csv produced by consolidate-proforma-costs.ts,
 * fetches last_purchase_price for each code, and writes a comparison CSV.
 *
 * Usage: npx tsx scripts/compare-proforma-vs-db-prices.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const PRIMARY_CSV = 'D:\\Pedidos\\Proformas\\costos_unificados.csv';
const FALLBACK_CSV = 'D:\\Pedidos\\Proformas\\costos_unificados.NEW.csv';
const OUTPUT_CSV = 'D:\\Pedidos\\Proformas\\comparacion_precios_proforma_vs_db.csv';
const EPSILON = 0.005; // last_purchase_price has 2 decimals; treat |diff| < 0.005 as equal

const prisma = new PrismaClient();

function pickInputCsv(): string {
  // If .NEW exists, it's fresher than the primary (primary may be locked in Excel)
  if (fs.existsSync(FALLBACK_CSV)) {
    const newStat = fs.statSync(FALLBACK_CSV);
    const primaryExists = fs.existsSync(PRIMARY_CSV);
    if (!primaryExists || newStat.mtimeMs > fs.statSync(PRIMARY_CSV).mtimeMs) {
      return FALLBACK_CSV;
    }
  }
  return PRIMARY_CSV;
}

interface CsvRow {
  codigo: string;
  descripcion_db: string;
  descripcion_proforma: string;
  size_db: string;
  size_proforma: string;
  max_precio: number;
  proveedor: string;
  proforma: string;
  fecha: string;
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

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv(filePath: string, headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsv).join(','));
  const content = '﻿' + lines.join('\r\n') + '\r\n';
  try {
    fs.writeFileSync(filePath, content);
    return filePath;
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EBUSY') {
      const ext = path.extname(filePath);
      const base = filePath.slice(0, -ext.length);
      const altPath = `${base}.NEW${ext}`;
      fs.writeFileSync(altPath, content);
      console.log(`  WARN: ${filePath} locked, wrote ${altPath} instead`);
      return altPath;
    }
    throw err;
  }
}

async function main(): Promise<void> {
  const INPUT_CSV = pickInputCsv();
  console.log(`Reading ${INPUT_CSV}...`);
  const raw = stripBom(fs.readFileSync(INPUT_CSV, 'utf-8'));
  const parsed = parseCsv(raw);

  if (parsed.length < 2) {
    throw new Error('CSV de entrada vacío o sin filas de datos');
  }

  const header = parsed[0].map((h) => h.toLowerCase().trim());
  const idx = {
    codigo: header.indexOf('codigo'),
    descripcion_db: header.indexOf('descripcion_db'),
    descripcion_proforma: header.indexOf('descripcion_proforma'),
    size_db: header.indexOf('size_db'),
    size_proforma: header.indexOf('size_proforma'),
    max_precio: header.indexOf('max_precio'),
    proveedor: header.indexOf('proveedor'),
    proforma: header.indexOf('proforma'),
    fecha: header.indexOf('fecha'),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v < 0) throw new Error(`Columna faltante en CSV: ${k}`);
  }

  const items: CsvRow[] = parsed.slice(1).map((row) => ({
    codigo: row[idx.codigo],
    descripcion_db: row[idx.descripcion_db],
    descripcion_proforma: row[idx.descripcion_proforma],
    size_db: row[idx.size_db],
    size_proforma: row[idx.size_proforma],
    max_precio: parseFloat(row[idx.max_precio]),
    proveedor: row[idx.proveedor],
    proforma: row[idx.proforma],
    fecha: row[idx.fecha],
  }));

  console.log(`Loaded ${items.length} matched items.\n`);

  // Fetch last_purchase_price + unit_price + description + size for all codes
  const codes = items.map((i) => i.codigo);
  const articles = await prisma.articles.findMany({
    where: { code: { in: codes }, deleted_at: null },
    select: {
      code: true,
      description: true,
      size: true,
      last_purchase_price: true,
      unit_price: true,
    },
  });

  interface DbInfo {
    description: string;
    size: string;
    last_purchase_price: number | null;
    unit_price: number;
  }
  const dbMap = new Map<string, DbInfo>();
  for (const a of articles) {
    dbMap.set(a.code, {
      description: a.description,
      size: a.size ?? '',
      last_purchase_price:
        a.last_purchase_price === null ? null : parseFloat(a.last_purchase_price.toString()),
      unit_price: parseFloat(a.unit_price.toString()),
    });
  }

  // Build comparison rows
  type Status = 'equal' | 'different' | 'db_null' | 'not_found';

  interface CompareRow {
    codigo: string;
    descripcion_db: string;
    descripcion_proforma: string;
    size_db: string;
    size_proforma: string;
    proveedor: string;
    proforma: string;
    fecha: string;
    proforma_max_price: number;
    db_last_purchase_price: number | null;
    diff_abs: number | null;
    diff_pct: number | null;
    status: Status;
  }

  const out: CompareRow[] = items.map((item) => {
    const db = dbMap.get(item.codigo);
    // Always reflect the current DB description/size in the output, even if the
    // CSV's stored db description is stale.
    const dbDesc = db?.description ?? item.descripcion_db;
    const dbSize = db?.size ?? item.size_db;

    if (!db) {
      return {
        codigo: item.codigo,
        descripcion_db: dbDesc,
        descripcion_proforma: item.descripcion_proforma,
        size_db: dbSize,
        size_proforma: item.size_proforma,
        proveedor: item.proveedor,
        proforma: item.proforma,
        fecha: item.fecha,
        proforma_max_price: item.max_precio,
        db_last_purchase_price: null,
        diff_abs: null,
        diff_pct: null,
        status: 'not_found',
      };
    }
    if (db.last_purchase_price === null) {
      return {
        codigo: item.codigo,
        descripcion_db: dbDesc,
        descripcion_proforma: item.descripcion_proforma,
        size_db: dbSize,
        size_proforma: item.size_proforma,
        proveedor: item.proveedor,
        proforma: item.proforma,
        fecha: item.fecha,
        proforma_max_price: item.max_precio,
        db_last_purchase_price: null,
        diff_abs: null,
        diff_pct: null,
        status: 'db_null',
      };
    }
    const diffAbs = item.max_precio - db.last_purchase_price;
    const diffPct = db.last_purchase_price === 0 ? null : (diffAbs / db.last_purchase_price) * 100;
    const status: Status = Math.abs(diffAbs) < EPSILON ? 'equal' : 'different';
    return {
      codigo: item.codigo,
      descripcion_db: dbDesc,
      descripcion_proforma: item.descripcion_proforma,
      size_db: dbSize,
      size_proforma: item.size_proforma,
      proveedor: item.proveedor,
      proforma: item.proforma,
      fecha: item.fecha,
      proforma_max_price: item.max_precio,
      db_last_purchase_price: db.last_purchase_price,
      diff_abs: diffAbs,
      diff_pct: diffPct,
      status,
    };
  });

  await prisma.$disconnect();

  // Sort: 'different' first (largest |diff_pct|), then db_null, then not_found, then equal
  const statusOrder: Record<Status, number> = {
    different: 0,
    db_null: 1,
    not_found: 2,
    equal: 3,
  };
  out.sort((a, b) => {
    const so = statusOrder[a.status] - statusOrder[b.status];
    if (so !== 0) return so;
    if (a.status === 'different') {
      return Math.abs(b.diff_pct ?? 0) - Math.abs(a.diff_pct ?? 0);
    }
    return a.codigo.localeCompare(b.codigo);
  });

  const writtenPath = writeCsv(
    OUTPUT_CSV,
    [
      'codigo',
      'descripcion_db',
      'descripcion_proforma',
      'size_db',
      'size_proforma',
      'proveedor',
      'proforma',
      'fecha',
      'proforma_max_price',
      'db_last_purchase_price',
      'diff_abs',
      'diff_pct',
      'status',
    ],
    out.map((r) => [
      r.codigo,
      r.descripcion_db,
      r.descripcion_proforma,
      r.size_db,
      r.size_proforma,
      r.proveedor,
      r.proforma,
      r.fecha,
      r.proforma_max_price.toFixed(4),
      r.db_last_purchase_price === null ? '' : r.db_last_purchase_price.toFixed(2),
      r.diff_abs === null ? '' : r.diff_abs.toFixed(4),
      r.diff_pct === null ? '' : r.diff_pct.toFixed(2),
      r.status,
    ])
  );

  // Summary
  const eq = out.filter((r) => r.status === 'equal').length;
  const diff = out.filter((r) => r.status === 'different').length;
  const dbNull = out.filter((r) => r.status === 'db_null').length;
  const notFound = out.filter((r) => r.status === 'not_found').length;

  // Distribution of differences
  const diffs = out
    .filter((r) => r.status === 'different' && r.diff_pct !== null)
    .map((r) => r.diff_pct as number);
  const proformaHigher = diffs.filter((d) => d > 0).length;
  const proformaLower = diffs.filter((d) => d < 0).length;

  console.log(`--- Resumen Comparación ---`);
  console.log(`Total items comparados:  ${out.length}`);
  console.log(`  Iguales (Δ < $${EPSILON}): ${eq}`);
  console.log(`  Diferentes:              ${diff}`);
  console.log(`    proforma > db:         ${proformaHigher}`);
  console.log(`    proforma < db:         ${proformaLower}`);
  console.log(`  DB last_purchase_price NULL: ${dbNull}`);
  console.log(`  Código no encontrado en DB: ${notFound}`);
  console.log();
  console.log(`Output: ${writtenPath}`);

  // Top 10 biggest diffs
  const top = out.filter((r) => r.status === 'different').slice(0, 10);
  if (top.length > 0) {
    console.log(`\n--- Top 10 mayores diferencias (% sobre DB) ---`);
    console.log(
      `${'codigo'.padEnd(13)} ${'proforma_max'.padStart(12)} ${'db_last'.padStart(10)} ${'diff_abs'.padStart(10)} ${'diff_%'.padStart(9)}  fuente`
    );
    for (const r of top) {
      const diffSign = (r.diff_abs as number) >= 0 ? '+' : '';
      console.log(
        `${r.codigo.padEnd(13)} ${r.proforma_max_price.toFixed(2).padStart(12)} ${(r.db_last_purchase_price as number).toFixed(2).padStart(10)} ${(diffSign + (r.diff_abs as number).toFixed(2)).padStart(10)} ${(diffSign + (r.diff_pct as number).toFixed(1) + '%').padStart(9)}  ${r.proforma} ${r.fecha}`
      );
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
