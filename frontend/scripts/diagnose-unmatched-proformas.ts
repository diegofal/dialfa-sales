/**
 * Diagnose why items in proforma CSVs failed to match SPISA articles.
 *
 * Reprocesses all CSVs (with same dedup logic), captures
 * debugInfo from ArticleMatcher for each unmatched item, and writes a
 * diagnostic CSV grouped by failure mode.
 *
 * Usage: npx tsx scripts/diagnose-unmatched-proformas.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { ArticleMatcher } from '../lib/utils/priceLists/proformaImport/article-matcher';
import { CsvExtractor } from '../lib/utils/priceLists/proformaImport/csv-extractor';
import { MatchingKeyNormalizer } from '../lib/utils/priceLists/proformaImport/matching-normalizer';

const KNOWN_CANONICAL_TYPES = new Set([
  'ELBOW_90_LR',
  'ELBOW_90_SR',
  'ELBOW_45',
  'ELBOW_180',
  '90D LR THREADED SW ELBOW',
  '90D LR THREADED BSPT ELBOW',
  '90D LR THREADED NPT ELBOW',
  '45D S.W. ELBOW',
  '45D LR THREADED BSPT ELBOW',
  '45D LR THREADED NPT ELBOW',
  'TEE',
  'TEE S.W.',
  'TEE BSPT',
  'TEE NPT',
  'REDUCER_TEE',
  'CAP',
  'REDUCER',
  'REDUCER_CONCENTRIC',
  'REDUCER_ECCENTRIC',
  'CROSS',
  'NIPPLE',
  'NIPPLE_NPT',
  'NIPPLE_BSPT',
  'Stud bolt, A193-B7',
  'Heavy Nuts, A194-2H',
  'UNION SW',
  'UNION BSPT',
  'UNION NPT',
  'COUPLING SW',
  'COUPLING BSPT',
  'COUPLING NPT',
  'HEX HEAD PLUG BSPT',
  'HEX HEAD PLUG NPT',
  'HEX HEAD BUSHING BSPT',
  'HEX HEAD BUSHING NPT',
  'W.N.R.F.',
  'SORF',
  'BLIND',
  'THREADED',
]);

const CSV_DIR = 'D:\\Pedidos\\Proformas\\csvs';
const OUTPUT_CSV = 'D:\\Pedidos\\Proformas\\diagnostico_sin_match.csv';
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
  if (standard) {
    return {
      fileName,
      supplier: standard[1],
      proformaNumber: standard[2],
      date: standard[3],
    };
  }
  const reversed = fileName.match(/^([^_]+)_(\d{2}-\d{2}-\d{4})_([^_]+)\.csv$/i);
  if (reversed) {
    const [day, month, year] = reversed[2].split('-');
    return {
      fileName,
      supplier: reversed[1],
      proformaNumber: reversed[3],
      date: `${year}-${month}-${day}`,
    };
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

function writeCsv(filePath: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsv).join(','));
  fs.writeFileSync(filePath, '﻿' + lines.join('\r\n') + '\r\n');
}

/**
 * Categorize failure mode for human-readable reporting.
 */
function categorize(description: string, size: string, canonicalType: string): string {
  // 1. Description looks corrupted (just a size, no real product name)
  if (description.trim().length <= 4 && /^\d+["']?$/.test(description.trim())) {
    return '1_descripcion_corrupta';
  }
  // 2. Curly quotes in size (U+201C/U+201D) — block size normalization
  if (/[“”]/.test(size)) {
    return '2_curly_quotes_size';
  }
  // 3. Type was NOT normalized to a canonical form — normalizer gap
  if (!KNOWN_CANONICAL_TYPES.has(canonicalType)) {
    return '3_normalizer_gap';
  }
  // 4. Type was normalized OK but lookup still failed — missing article in DB or other
  return '4_normalizado_pero_sin_match';
}

async function main(): Promise<void> {
  const allFiles = fs.readdirSync(CSV_DIR).filter((f) => f.toLowerCase().endsWith('.csv'));
  const parsed: FileInfo[] = [];
  for (const fn of allFiles) {
    const info = parseFileName(fn);
    if (info) parsed.push({ ...info, filePath: path.join(CSV_DIR, fn) });
  }
  const kept = dedupe(parsed);

  console.log(`Processing ${kept.length} CSVs...\n`);

  const extractor = new CsvExtractor();
  const matcher = new ArticleMatcher(prisma);

  interface DiagRow {
    proveedor: string;
    proforma: string;
    fecha: string;
    description: string;
    size: string;
    quantity: number;
    unitPrice: number;
    extractedType: string;
    canonicalType: string;
    extractedSeries: string;
    extractedThickness: string;
    extractedSize: string;
    noMatchReason: string;
    category: string;
  }

  const allDiag: DiagRow[] = [];

  for (const file of kept) {
    const buffer = fs.readFileSync(file.filePath);
    const proforma = await extractor.extract(buffer, file.fileName);
    const results = await matcher.matchItems(proforma.items);

    for (const result of results) {
      if (result.article && result.confidence >= MATCH_CONFIDENCE_THRESHOLD) continue;

      const item = result.extractedItem;
      const dbg = result.debugInfo;
      const extractedType = dbg?.extractedType || '';
      const canonicalType = MatchingKeyNormalizer.normalizeProductType(
        extractedType,
        item.description
      );
      const category = categorize(item.description, item.size, canonicalType);

      allDiag.push({
        proveedor: file.supplier,
        proforma: file.proformaNumber,
        fecha: file.date,
        description: item.description,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        extractedType,
        canonicalType,
        extractedSeries: dbg?.extractedSeries || '',
        extractedThickness: dbg?.extractedThickness || '',
        extractedSize: dbg?.extractedSize || '',
        noMatchReason: dbg?.noMatchReason || '',
        category,
      });
    }
  }

  await matcher.cleanup();
  await prisma.$disconnect();

  // Sort by category, then description
  allDiag.sort((a, b) => {
    const c = a.category.localeCompare(b.category);
    if (c !== 0) return c;
    const d = a.description.localeCompare(b.description);
    if (d !== 0) return d;
    return a.size.localeCompare(b.size);
  });

  writeCsv(
    OUTPUT_CSV,
    [
      'category',
      'proveedor',
      'proforma',
      'fecha',
      'description',
      'size',
      'quantity',
      'unit_price',
      'extracted_type',
      'canonical_type',
      'extracted_series',
      'extracted_thickness',
      'extracted_size',
      'no_match_reason',
    ],
    allDiag.map((r) => [
      r.category,
      r.proveedor,
      r.proforma,
      r.fecha,
      r.description,
      r.size,
      r.quantity,
      r.unitPrice.toFixed(4),
      r.extractedType,
      r.canonicalType,
      r.extractedSeries,
      r.extractedThickness,
      r.extractedSize,
      r.noMatchReason,
    ])
  );

  // Summary by category
  const counts = new Map<string, number>();
  for (const r of allDiag) {
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

  console.log(`Total unmatched items: ${allDiag.length}\n`);
  console.log(`--- Causas de fallo ---`);
  for (const [cat, n] of sorted) {
    console.log(`  ${cat.padEnd(30)} ${n.toString().padStart(4)}`);
  }
  console.log(`\nOutput: ${OUTPUT_CSV}`);

  // Group normalizer_gap by canonicalType to see which types are not handled
  const gapTypes = new Map<string, number>();
  for (const r of allDiag) {
    if (r.category === '3_normalizer_gap') {
      gapTypes.set(r.canonicalType, (gapTypes.get(r.canonicalType) ?? 0) + 1);
    }
  }
  if (gapTypes.size > 0) {
    console.log(`\n--- Normalizer gaps: tipos canónicos NO reconocidos ---`);
    const sortedGaps = Array.from(gapTypes.entries()).sort((a, b) => b[1] - a[1]);
    for (const [t, n] of sortedGaps) {
      console.log(`  ${n.toString().padStart(3)}× "${t}"`);
    }
  }

  // Group "normalized but no match" by canonicalType
  const matchedTypes = new Map<string, number>();
  for (const r of allDiag) {
    if (r.category === '4_normalizado_pero_sin_match') {
      matchedTypes.set(r.canonicalType, (matchedTypes.get(r.canonicalType) ?? 0) + 1);
    }
  }
  if (matchedTypes.size > 0) {
    console.log(`\n--- Tipos normalizados OK pero sin match en DB ---`);
    const sortedM = Array.from(matchedTypes.entries()).sort((a, b) => b[1] - a[1]);
    for (const [t, n] of sortedM) {
      console.log(`  ${n.toString().padStart(3)}× "${t}"`);
    }
  }

  // Show 2-3 examples per category
  console.log(`\n--- Ejemplos por categoría ---`);
  for (const [cat] of sorted) {
    const examples = allDiag.filter((r) => r.category === cat).slice(0, 4);
    console.log(`\n[${cat}]`);
    for (const e of examples) {
      console.log(
        `  desc="${e.description}" size="${e.size}"  → canonical="${e.canonicalType}" series=${e.extractedSeries || '-'} thick=${e.extractedThickness || '-'} size_n=${e.extractedSize}`
      );
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
