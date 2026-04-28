/**
 * Consolidate supplier cost data from CSV proformas.
 *
 * Reads all CSVs in D:\Pedidos\Proformas\csvs\, deduplicates by proforma
 * number (keeping the most recent file date), matches each item to a SPISA
 * article code via ArticleMatcher, and writes two CSVs:
 *
 *   - costos_unificados.csv  — items matched to article code (max price across all suppliers)
 *   - costos_sin_match.csv   — items that did not match (for manual review)
 *
 * Usage: npx tsx scripts/consolidate-proforma-costs.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { ArticleMatcher } from '../lib/utils/priceLists/proformaImport/article-matcher';
import { CsvExtractor } from '../lib/utils/priceLists/proformaImport/csv-extractor';

const CSV_DIR = 'D:\\Pedidos\\Proformas\\csvs';
const OUTPUT_DIR = 'D:\\Pedidos\\Proformas';
const MATCHED_OUT = path.join(OUTPUT_DIR, 'costos_unificados.csv');
const UNMATCHED_OUT = path.join(OUTPUT_DIR, 'costos_sin_match.csv');
const MATCH_CONFIDENCE_THRESHOLD = 70;

const prisma = new PrismaClient();

interface FileInfo {
  fileName: string;
  filePath: string;
  supplier: string;
  proformaNumber: string;
  date: string; // YYYY-MM-DD
}

interface AggregatedMatched {
  code: string;
  dbDescription: string;
  dbSize: string;
  proformaDescription: string;
  proformaSize: string;
  maxPrice: number;
  proformaNumber: string;
  proformaDate: string;
  supplier: string;
}

interface AggregatedUnmatched {
  description: string;
  size: string;
  maxPrice: number;
  proformaNumber: string;
  proformaDate: string;
  supplier: string;
}

/**
 * Parse filename. Supports two conventions:
 *   - Standard:  {Supplier}_{ProformaNumber}_{YYYY-MM-DD}.csv
 *   - Reversed:  {Supplier}_{DD-MM-YYYY}_{ProformaNumber}.csv
 */
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

interface DedupeResult {
  kept: FileInfo[];
  discarded: { file: FileInfo; reason: string }[];
}

function dedupeByProforma(files: FileInfo[]): DedupeResult {
  const map = new Map<string, FileInfo>();
  const discarded: DedupeResult['discarded'] = [];

  for (const file of files) {
    const key = file.proformaNumber.toUpperCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, file);
      continue;
    }

    if (file.date > existing.date) {
      discarded.push({
        file: existing,
        reason: `older duplicate of ${key} (kept ${file.fileName})`,
      });
      map.set(key, file);
    } else {
      discarded.push({
        file,
        reason: `older duplicate of ${key} (kept ${existing.fileName})`,
      });
    }
  }

  return { kept: Array.from(map.values()), discarded };
}

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv(filePath: string, headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  // BOM for Excel UTF-8 detection + CRLF for Windows/Excel compatibility
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
      console.log(`  WARN: ${filePath} locked by another program, wrote ${altPath} instead`);
      return altPath;
    }
    throw err;
  }
}

async function main(): Promise<void> {
  console.log(`Reading CSVs from ${CSV_DIR}...`);

  const allFiles = fs
    .readdirSync(CSV_DIR)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .sort();

  console.log(`Found ${allFiles.length} CSV files.\n`);

  // Parse filenames
  const parsed: FileInfo[] = [];
  const unparseable: string[] = [];
  for (const fn of allFiles) {
    const info = parseFileName(fn);
    if (info) {
      parsed.push({ ...info, filePath: path.join(CSV_DIR, fn) });
    } else {
      unparseable.push(fn);
    }
  }

  if (unparseable.length > 0) {
    console.log(`WARN: ${unparseable.length} filename(s) could not be parsed:`);
    for (const fn of unparseable) console.log(`  - ${fn}`);
    console.log();
  }

  // Dedupe by proforma number
  const { kept, discarded } = dedupeByProforma(parsed);

  console.log(`Deduplication: ${kept.length} kept, ${discarded.length} discarded.`);
  for (const d of discarded) {
    console.log(`  DISCARDED ${d.file.fileName} — ${d.reason}`);
  }
  console.log();

  // Process each file
  const extractor = new CsvExtractor();
  const matcher = new ArticleMatcher(prisma);

  const matchedAgg = new Map<string, AggregatedMatched>();
  const unmatchedAgg = new Map<string, AggregatedUnmatched>();

  let totalItems = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;
  let filesWithError = 0;

  for (const file of kept) {
    process.stdout.write(`  ${file.fileName}... `);
    try {
      const buffer = fs.readFileSync(file.filePath);
      const proforma = await extractor.extract(buffer, file.fileName);
      const results = await matcher.matchItems(proforma.items);

      let fileMatched = 0;
      let fileUnmatched = 0;

      for (const result of results) {
        const item = result.extractedItem;
        totalItems++;

        if (result.article && result.confidence >= MATCH_CONFIDENCE_THRESHOLD) {
          const code = result.article.code;
          const existing = matchedAgg.get(code);
          if (!existing || item.unitPrice > existing.maxPrice) {
            matchedAgg.set(code, {
              code,
              dbDescription: result.article.description,
              dbSize: result.article.size ?? '',
              proformaDescription: item.description,
              proformaSize: item.size,
              maxPrice: item.unitPrice,
              proformaNumber: file.proformaNumber,
              proformaDate: file.date,
              supplier: file.supplier,
            });
          }
          fileMatched++;
          totalMatched++;
        } else {
          const key = item.description.trim().toUpperCase() + '|' + item.size.trim().toUpperCase();
          const existing = unmatchedAgg.get(key);
          if (!existing || item.unitPrice > existing.maxPrice) {
            unmatchedAgg.set(key, {
              description: item.description,
              size: item.size,
              maxPrice: item.unitPrice,
              proformaNumber: file.proformaNumber,
              proformaDate: file.date,
              supplier: file.supplier,
            });
          }
          fileUnmatched++;
          totalUnmatched++;
        }
      }

      console.log(
        `${fileMatched} matched / ${fileUnmatched} unmatched (${proforma.items.length} items)`
      );
    } catch (err) {
      filesWithError++;
      console.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await matcher.cleanup();
  await prisma.$disconnect();

  // Sort and write outputs
  const matchedRows = Array.from(matchedAgg.values()).sort((a, b) => a.code.localeCompare(b.code));
  const unmatchedRows = Array.from(unmatchedAgg.values()).sort(
    (a, b) => a.description.localeCompare(b.description) || a.size.localeCompare(b.size)
  );

  const matchedPath = writeCsv(
    MATCHED_OUT,
    [
      'codigo',
      'descripcion_db',
      'descripcion_proforma',
      'size_db',
      'size_proforma',
      'max_precio',
      'proveedor',
      'proforma',
      'fecha',
    ],
    matchedRows.map((r) => [
      r.code,
      r.dbDescription,
      r.proformaDescription,
      r.dbSize,
      r.proformaSize,
      r.maxPrice.toFixed(4),
      r.supplier,
      r.proformaNumber,
      r.proformaDate,
    ])
  );

  const unmatchedPath = writeCsv(
    UNMATCHED_OUT,
    ['descripcion', 'size', 'max_precio', 'proveedor', 'proforma', 'fecha'],
    unmatchedRows.map((r) => [
      r.description,
      r.size,
      r.maxPrice.toFixed(4),
      r.supplier,
      r.proformaNumber,
      r.proformaDate,
    ])
  );

  // Summary
  console.log(`\n--- Summary ---`);
  console.log(`Files processed:    ${kept.length} (${filesWithError} with errors)`);
  console.log(`Total items:        ${totalItems}`);
  console.log(`Matched items:      ${totalMatched}`);
  console.log(`Unmatched items:    ${totalUnmatched}`);
  console.log(`Unique codes:       ${matchedRows.length}`);
  console.log(`Unique unmatched:   ${unmatchedRows.length}`);
  console.log();
  console.log(`Output:`);
  console.log(`  ${matchedPath}     (${matchedRows.length} rows)`);
  console.log(`  ${unmatchedPath}   (${unmatchedRows.length} rows)`);

  // Top 5 most expensive matched items
  const top = [...matchedRows].sort((a, b) => b.maxPrice - a.maxPrice).slice(0, 5);
  if (top.length > 0) {
    console.log(`\n--- Top 5 más caros (matcheados) ---`);
    for (const r of top) {
      console.log(
        `  ${r.code.padEnd(12)} $${r.maxPrice.toFixed(2).padStart(10)}  ${r.proformaNumber} ${r.proformaDate}  — ${r.dbDescription}`
      );
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
