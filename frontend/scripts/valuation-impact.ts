/**
 * Calculate the inventory valuation impact of replacing
 * articles.last_purchase_price with the max price observed in proformas.
 *
 * For each code in the comparison file: queries current stock from DB,
 * then computes valuation_db = stock * db_price vs valuation_proforma =
 * stock * proforma_price. Reports totals split by direction
 * (db_mayor / proforma_mayor) and the net delta.
 *
 * Usage: npx tsx scripts/valuation-impact.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const PRIMARY = 'D:\\Pedidos\\Proformas\\comparacion_precios_proforma_vs_db.csv';
const FALLBACK = 'D:\\Pedidos\\Proformas\\comparacion_precios_proforma_vs_db.NEW.csv';
const OUTPUT = 'D:\\Pedidos\\Proformas\\impacto_valorizacion.csv';

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

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function main(): Promise<void> {
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
    diff_abs: idx('diff_abs'),
    diff_pct: idx('diff_pct'),
    status: idx('status'),
    proforma: idx('proforma'),
    fecha: idx('fecha'),
  };

  // Take only items with status=different (where DB and proforma disagree)
  const diffs = rows.slice(1).filter((r) => r[I.status] === 'different');

  // Fetch current stock for all codes
  const codes = diffs.map((r) => r[I.codigo]);
  const articles = await prisma.articles.findMany({
    where: { code: { in: codes }, deleted_at: null },
    select: { code: true, stock: true },
  });
  const stockMap = new Map<string, number>();
  for (const a of articles) {
    stockMap.set(a.code, parseFloat(a.stock.toString()));
  }
  await prisma.$disconnect();

  // Compute per-row valuation
  interface Row {
    codigo: string;
    descripcion: string;
    proforma_price: number;
    db_price: number;
    stock: number;
    direccion: 'db_mayor' | 'proforma_mayor';
    valor_db: number;
    valor_proforma: number;
    delta: number; // proforma - db
    proforma: string;
    fecha: string;
  }

  const out: Row[] = diffs.map((r) => {
    const codigo = r[I.codigo];
    const proformaPrice = parseFloat(r[I.proforma_max_price]);
    const dbPrice = parseFloat(r[I.db_last_purchase_price]);
    const stock = stockMap.get(codigo) ?? 0;
    const direccion = proformaPrice > dbPrice ? 'proforma_mayor' : 'db_mayor';
    const valorDb = stock * dbPrice;
    const valorProforma = stock * proformaPrice;
    return {
      codigo,
      descripcion: r[I.descripcion_db],
      proforma_price: proformaPrice,
      db_price: dbPrice,
      stock,
      direccion,
      valor_db: valorDb,
      valor_proforma: valorProforma,
      delta: valorProforma - valorDb,
      proforma: r[I.proforma],
      fecha: r[I.fecha],
    };
  });

  // Sort by |delta| desc — biggest impact first
  out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const writtenPath = writeCsv(
    OUTPUT,
    [
      'codigo',
      'descripcion',
      'stock_actual',
      'db_last_purchase_price_USD',
      'proforma_max_price_USD',
      'direccion',
      'valor_stock_con_db_USD',
      'valor_stock_con_proforma_USD',
      'delta_USD',
      'proforma_origen',
      'fecha_origen',
    ],
    out.map((r) => [
      r.codigo,
      r.descripcion,
      r.stock.toString(),
      r.db_price.toFixed(2),
      r.proforma_price.toFixed(4),
      r.direccion,
      r.valor_db.toFixed(2),
      r.valor_proforma.toFixed(2),
      r.delta.toFixed(2),
      r.proforma,
      r.fecha,
    ])
  );

  // Aggregate stats
  const dbMayor = out.filter((r) => r.direccion === 'db_mayor');
  const proformaMayor = out.filter((r) => r.direccion === 'proforma_mayor');

  const sum = (arr: Row[], k: 'valor_db' | 'valor_proforma' | 'delta'): number =>
    arr.reduce((s, r) => s + r[k], 0);

  const totalDbMayor_db = sum(dbMayor, 'valor_db');
  const totalDbMayor_pf = sum(dbMayor, 'valor_proforma');
  const totalProfMayor_db = sum(proformaMayor, 'valor_db');
  const totalProfMayor_pf = sum(proformaMayor, 'valor_proforma');

  const total_db = totalDbMayor_db + totalProfMayor_db;
  const total_pf = totalDbMayor_pf + totalProfMayor_pf;
  const netDelta = total_pf - total_db;

  // Items with zero stock — different prices but no $ impact
  const dbMayor_withStock = dbMayor.filter((r) => r.stock > 0);
  const profMayor_withStock = proformaMayor.filter((r) => r.stock > 0);

  console.log(`\n--- Items con stock = 0 (sin impacto $) ---`);
  console.log(
    `  db_mayor:        ${dbMayor.length - dbMayor_withStock.length} de ${dbMayor.length}`
  );
  console.log(
    `  proforma_mayor:  ${proformaMayor.length - profMayor_withStock.length} de ${proformaMayor.length}`
  );

  console.log(`\n--- Valorización: items DB > Proforma (${dbMayor.length} items) ---`);
  console.log(`  Valor con DB price (actual):       $${fmtUSD(totalDbMayor_db)}`);
  console.log(`  Valor con Proforma price:          $${fmtUSD(totalDbMayor_pf)}`);
  console.log(`  Reducción si uso proforma:         $${fmtUSD(totalDbMayor_pf - totalDbMayor_db)}`);

  console.log(`\n--- Valorización: items Proforma > DB (${proformaMayor.length} items) ---`);
  console.log(`  Valor con DB price (actual):       $${fmtUSD(totalProfMayor_db)}`);
  console.log(`  Valor con Proforma price:          $${fmtUSD(totalProfMayor_pf)}`);
  console.log(
    `  Aumento si uso proforma:           $${fmtUSD(totalProfMayor_pf - totalProfMayor_db)}`
  );

  console.log(`\n--- TOTAL para los ${out.length} items con diferencia ---`);
  console.log(`  Valorización con DB price:         $${fmtUSD(total_db)}`);
  console.log(`  Valorización con Proforma price:   $${fmtUSD(total_pf)}`);
  console.log(
    `  DELTA NETO (proforma - db):        $${fmtUSD(netDelta)}  (${netDelta < 0 ? 'baja' : 'sube'})`
  );

  console.log(`\nOutput: ${writtenPath}`);

  // Top 10 individual deltas (largest absolute impact)
  console.log(`\n--- Top 10 items con mayor impacto $ individual ---`);
  console.log(
    `${'codigo'.padEnd(13)} ${'stock'.padStart(8)} ${'db'.padStart(8)} ${'proforma'.padStart(9)} ${'delta_$'.padStart(11)}  desc`
  );
  for (const r of out.slice(0, 10)) {
    const sign = r.delta >= 0 ? '+' : '';
    console.log(
      `${r.codigo.padEnd(13)} ${r.stock.toFixed(0).padStart(8)} ${r.db_price.toFixed(2).padStart(8)} ${r.proforma_price.toFixed(2).padStart(9)} ${(sign + r.delta.toFixed(2)).padStart(11)}  ${r.descripcion.slice(0, 35)}`
    );
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
