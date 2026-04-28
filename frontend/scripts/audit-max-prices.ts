/**
 * Audit the max-price logic by listing every (proforma, fecha, unit_price)
 * occurrence of each matched SPISA article code across all proformas.
 *
 * Re-processes the same 20 deduplicated CSVs as consolidate-proforma-costs.ts,
 * matches every item to a SPISA code, and writes one row per (code, proforma)
 * occurrence — sorted by code, then price desc. The first row per code shows
 * the max — same number that ends up in costos_unificados.
 *
 * Outputs:
 *   auditoria_precios_completa.csv — every occurrence (long format)
 *   auditoria_resumen_max.csv      — one row per code with max + all sources
 *
 * Usage: npx tsx scripts/audit-max-prices.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { ArticleMatcher } from '../lib/utils/priceLists/proformaImport/article-matcher';
import { CsvExtractor } from '../lib/utils/priceLists/proformaImport/csv-extractor';

const CSV_DIR = 'D:\\Pedidos\\Proformas\\csvs';
const OUTPUT_FULL = 'D:\\Pedidos\\Proformas\\auditoria_precios_completa.csv';
const OUTPUT_SUMMARY = 'D:\\Pedidos\\Proformas\\auditoria_resumen_max.csv';
const MATCH_CONFIDENCE_THRESHOLD = 70;

const prisma = new PrismaClient();

interface FileInfo {
  fileName: string;
  filePath: string;
  supplier: string;
  proformaNumber: string;
  date: string;
}

function parseFileName(fileName: string): Omit<FileInfo, 'filePath'> | null {
  const standard = fileName.match(/^([^_]+)_([^_]+)_(\d{4}-\d{2}-\d{2})\.csv$/i);
  if (standard)
    return {
      fileName,
      supplier: standard[1],
      proformaNumber: standard[2],
      date: standard[3],
    };
  const reversed = fileName.match(/^([^_]+)_(\d{2}-\d{2}-\d{4})_([^_]+)\.csv$/i);
  if (reversed) {
    const [d, m, y] = reversed[2].split('-');
    return { fileName, supplier: reversed[1], proformaNumber: reversed[3], date: `${y}-${m}-${d}` };
  }
  return null;
}

function dedupe(files: FileInfo[]): FileInfo[] {
  const map = new Map<string, FileInfo>();
  for (const f of files) {
    const k = f.proformaNumber.toUpperCase();
    const e = map.get(k);
    if (!e || f.date > e.date) map.set(k, f);
  }
  return Array.from(map.values());
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

interface Occurrence {
  code: string;
  dbDescription: string;
  dbSize: string;
  proformaDescription: string;
  proformaSize: string;
  unitPrice: number;
  quantity: number;
  proformaNumber: string;
  proformaDate: string;
  supplier: string;
  sourceFile: string;
}

async function main(): Promise<void> {
  const allFiles = fs.readdirSync(CSV_DIR).filter((f) => f.toLowerCase().endsWith('.csv'));
  const parsed: FileInfo[] = [];
  for (const fn of allFiles) {
    const info = parseFileName(fn);
    if (info) parsed.push({ ...info, filePath: path.join(CSV_DIR, fn) });
  }
  const kept = dedupe(parsed);

  console.log(`Auditing ${kept.length} CSVs (after dedup)...\n`);

  const extractor = new CsvExtractor();
  const matcher = new ArticleMatcher(prisma);

  // Collect every matched occurrence (one row per CSV row that matched a code)
  const allOccurrences: Occurrence[] = [];

  for (const file of kept) {
    const buffer = fs.readFileSync(file.filePath);
    const proforma = await extractor.extract(buffer, file.fileName);
    const results = await matcher.matchItems(proforma.items);

    for (const result of results) {
      if (!result.article || result.confidence < MATCH_CONFIDENCE_THRESHOLD) continue;
      allOccurrences.push({
        code: result.article.code,
        dbDescription: result.article.description,
        dbSize: result.article.size ?? '',
        proformaDescription: result.extractedItem.description,
        proformaSize: result.extractedItem.size,
        unitPrice: result.extractedItem.unitPrice,
        quantity: result.extractedItem.quantity,
        proformaNumber: file.proformaNumber,
        proformaDate: file.date,
        supplier: file.supplier,
        sourceFile: file.fileName,
      });
    }
  }

  await matcher.cleanup();
  await prisma.$disconnect();

  // Sort: code asc, then unit_price desc (so first row per code is the max)
  allOccurrences.sort((a, b) => {
    const c = a.code.localeCompare(b.code);
    if (c !== 0) return c;
    return b.unitPrice - a.unitPrice;
  });

  // Group by code → list of occurrences sorted by price desc
  const byCode = new Map<string, Occurrence[]>();
  for (const o of allOccurrences) {
    const arr = byCode.get(o.code) ?? [];
    arr.push(o);
    byCode.set(o.code, arr);
  }

  // 1) Full audit (long format) — every occurrence with rank within code
  const fullRows: (string | number)[][] = [];
  for (const occs of byCode.values()) {
    for (let i = 0; i < occs.length; i++) {
      const o = occs[i];
      fullRows.push([
        o.code,
        i + 1, // rank 1 = max
        i === 0 ? 'MAX' : '',
        o.dbDescription,
        o.dbSize,
        o.proformaDescription,
        o.proformaSize,
        o.unitPrice.toFixed(4),
        o.quantity,
        o.supplier,
        o.proformaNumber,
        o.proformaDate,
        o.sourceFile,
      ]);
    }
  }

  const fullPath = writeCsv(
    OUTPUT_FULL,
    [
      'codigo',
      'rank',
      'es_max',
      'descripcion_db',
      'size_db',
      'descripcion_proforma',
      'size_proforma',
      'unit_price_USD',
      'quantity',
      'proveedor',
      'proforma',
      'fecha',
      'archivo',
    ],
    fullRows
  );

  // 2) Summary — one row per code with max + count + all sources concatenated
  const summaryRows: (string | number)[][] = [];
  for (const [code, occs] of byCode.entries()) {
    const max = occs[0]; // sorted desc, first is max
    const allTrace = occs
      .map((o) => `${o.proformaNumber}(${o.proformaDate})=$${o.unitPrice.toFixed(4)}`)
      .join('  |  ');
    summaryRows.push([
      code,
      max.dbDescription,
      max.dbSize,
      occs.length, // # of proformas containing this code
      max.unitPrice.toFixed(4),
      max.proformaNumber,
      max.proformaDate,
      allTrace,
    ]);
  }
  summaryRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  const summaryPath = writeCsv(
    OUTPUT_SUMMARY,
    [
      'codigo',
      'descripcion_db',
      'size_db',
      'n_proformas_con_codigo',
      'max_unit_price_USD',
      'proforma_del_max',
      'fecha_del_max',
      'todas_las_ocurrencias',
    ],
    summaryRows
  );

  // Stats
  const totalCodes = byCode.size;
  const totalOccurrences = allOccurrences.length;
  const codesWithMultiple = Array.from(byCode.values()).filter((v) => v.length > 1).length;
  const codesWithSingle = totalCodes - codesWithMultiple;

  console.log(`Total ocurrencias matcheadas: ${totalOccurrences}`);
  console.log(`Códigos únicos:               ${totalCodes}`);
  console.log(`  ...con 1 sola ocurrencia:   ${codesWithSingle}`);
  console.log(`  ...con 2+ ocurrencias:      ${codesWithMultiple}`);
  console.log();
  console.log(`Output:`);
  console.log(`  ${fullPath}    (${fullRows.length} filas)`);
  console.log(`  ${summaryPath}     (${summaryRows.length} filas)`);

  // Show top-5 codes that appear in the most proformas (to demonstrate the algorithm works)
  const topRepeated = Array.from(byCode.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);
  console.log(`\n--- Top 5 códigos en más proformas (verificación) ---`);
  for (const [code, occs] of topRepeated) {
    const max = occs[0];
    const min = occs[occs.length - 1];
    console.log(
      `  ${code.padEnd(12)} aparece en ${occs.length.toString().padStart(2)} proformas — max $${max.unitPrice.toFixed(2)} (${max.proformaNumber}), min $${min.unitPrice.toFixed(2)} (${min.proformaNumber})`
    );
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
