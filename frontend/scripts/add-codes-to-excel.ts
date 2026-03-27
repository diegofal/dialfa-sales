/**
 * Script: Add SPISA article codes to supplier Excel price list.
 *
 * Reads "FORJADO Y ESPARRAGOS ABRIL 2026.xls", matches each data row
 * against the articles table in PostgreSQL, and writes a new Excel with
 * "Codigo SPISA" and "Descripcion SPISA" columns appended.
 *
 * Usage:  npx tsx scripts/add-codes-to-excel.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const INPUT = 'C:/Users/User/Desktop/FORJADO Y ESPARRAGOS ABRIL 2026.xls';
const OUTPUT = 'C:/Users/User/Desktop/FORJADO Y ESPARRAGOS ABRIL 2026 - CON CODIGOS v3.xlsx';
const CSV_OUTPUT = 'C:/Users/User/Desktop/PEDIDO BESTFLOW ABRIL 2026.csv';

// ── helpers ──────────────────────────────────────────────────────────

/** Decimal → fraction string (only the values that appear in the Excel) */
const DECIMAL_TO_FRAC: Record<string, string> = {
  '0.25': '1/4',
  '0.375': '3/8',
  '0.5': '1/2',
  '0.75': '3/4',
  '1': '1',
  '1.25': '1 1/4',
  '1.5': '1 1/2',
  '2': '2',
  '3': '3',
  '4': '4',
};

/**
 * Normalise a size value coming from the Excel so it matches the DB format.
 *  - numeric 0.5 → "1/2\""
 *  - "11/4\"" → "1 1/4\""   (compound fraction without space)
 *  - leaves "1/2\"" untouched
 */
function normaliseSize(raw: string | number | null | undefined): string {
  if (raw == null) return '';
  let s = String(raw)
    .trim()
    .replace(/"+/g, '')
    .replace(/^\s+|\s+$/g, '');
  if (!s) return '';

  // Pure decimal numbers (0.5, 0.75, 1.25 …)
  const num = Number(s);
  if (!isNaN(num) && DECIMAL_TO_FRAC[s] !== undefined) {
    return DECIMAL_TO_FRAC[s] + '"';
  }

  // Compound fractions without space: "11/2" → "1 1/2", "21/2" → "2 1/2"
  // But NOT "1/2" or "3/4" (pure fractions) – only when integer part > 0
  s = s.replace(/^(\d+)(\d\/\d+)/, '$1 $2');

  // Ensure trailing "
  if (!s.endsWith('"')) s += '"';
  return s;
}

/**
 * Normalise a bushing size like "3/4X1/2\"" → "3/4\" x 1/2\""
 * or "1 1/4X1/2" → "1 1/4\" x 1/2\""
 */
function normaliseBushingSize(raw: string | number | null | undefined): string {
  if (raw == null) return '';
  const s = String(raw).trim().replace(/"+/g, '');

  // Split on X (case-insensitive)
  const parts = s.split(/[xX]/);
  if (parts.length === 2) {
    const a = normaliseSize(parts[0].trim());
    const b = normaliseSize(parts[1].trim());
    // DB format: 3/4" x 1/2" (quotes on each dimension)
    const aPart = a.endsWith('"') ? a : a + '"';
    const bPart = b.endsWith('"') ? b : b + '"';
    return `${aPart} x ${bPart}`;
  }
  return normaliseSize(raw);
}

/**
 * Normalise a stud size like '1/2"X2-3/4"' → '1/2" x 2 3/4"'
 * Dashes between numbers become spaces (compound fractions).
 */
function normaliseStudSize(raw: string | number | null | undefined): string {
  if (raw == null) return '';
  let s = String(raw).trim().replace(/"+/g, '');
  // Handle leading "E" (typo in Excel, e.g. "E3/4\"X7-1/2\"")
  s = s.replace(/^E/i, '');

  const parts = s.split(/[xX]/);
  if (parts.length === 2) {
    let a = parts[0].trim();
    let b = parts[1].trim();
    // Convert dashes in b to spaces: "2-3/4" → "2 3/4"
    b = b.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    // Normalise compound fractions
    a = normaliseSize(a).replace(/"$/, '');
    b = normaliseSize(b).replace(/"$/, '');
    return `${a}" x ${b}"`;
  }
  return normaliseSize(raw);
}

// ── Excel → DB type mapping ──────────────────────────────────────────

interface TypeMapping {
  type: string;
  series: number | null;
}

function getDbType(product: string, thread: string, series: number | null): TypeMapping | null {
  const p = product.toUpperCase().trim();
  const t = thread.toUpperCase().trim();

  // Determine connection type
  const isBSPT = t.includes('BSPT');
  const isNPT = t.includes('NPT') && !t.includes('BSPT');
  const isSW = t.includes('SW') || t.includes('SCH');

  if (p.includes('ELBOW 90') || p === 'ELBOW 90º') {
    if (isBSPT) return { type: '90D LR THREADED BSPT ELBOW', series };
    if (isNPT) return { type: '90D LR THREADED NPT ELBOW', series };
    if (isSW) return { type: '90D LR THREADED SW ELBOW', series };
  }
  if (p.includes('ELBOW 45') || p === 'ELBOW 45º') {
    if (isBSPT) return { type: '45D LR THREADED BSPT ELBOW', series };
    if (isNPT) return { type: '45D LR THREADED NPT ELBOW', series };
    if (isSW) return { type: '45D S.W. ELBOW', series };
  }
  if (p === 'TEE') {
    if (isBSPT) return { type: 'TEE BSPT', series };
    if (isNPT) return { type: 'TEE NPT', series };
    if (isSW) return { type: 'TEE S.W.', series };
  }
  if (p.includes('UNION')) {
    if (isBSPT) return { type: 'UNION BSPT', series };
    if (isNPT) return { type: 'UNION NPT', series };
    if (isSW) return { type: 'UNION SW', series };
  }
  if (p.includes('COUPLING')) {
    if (isBSPT) return { type: 'COUPLING BSPT', series };
    if (isNPT) return { type: 'COUPLING NPT', series };
    if (isSW) return { type: 'COUPLING SW', series };
  }
  if (p.includes('HEX HEAD PLUG') || p.includes('HEX HEAD PLUG')) {
    if (isBSPT) return { type: 'HEX HEAD PLUG BSPT', series };
    if (isNPT) return { type: 'HEX HEAD PLUG NPT', series };
  }
  if (p.includes('HEX HEAD BUSHING') || p.includes('BUSHING')) {
    if (isBSPT) return { type: 'HEX HEAD BUSHING BSPT', series };
    if (isNPT) return { type: 'HEX HEAD BUSHING NPT', series };
  }
  if (p.includes('NIPPLE') || p.includes('HEX THD NIPPLE')) {
    if (isBSPT) return { type: 'NIPPLE BSPT', series };
    if (isNPT) return { type: 'NIPPLE NPT', series };
  }
  if (p.includes('CAP')) {
    // CAP = Tapa in DB (code starts with TA, type is null, series 3000)
    if (isBSPT) return { type: '__TAPA_BSPT__', series: 3000 };
    if (isNPT) return { type: '__TAPA_NPT__', series: 3000 };
  }
  return null;
}

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  try {
    // 1. Load all relevant articles from DB
    const allArticles = await prisma.articles.findMany({
      where: { deleted_at: null },
      select: { code: true, description: true, type: true, series: true, size: true },
    });

    // Build lookup: key = "TYPE|SERIES|SIZE" (all uppercase, trimmed)
    const articleMap = new Map<string, { code: string; description: string }>();
    for (const a of allArticles) {
      if (!a.type || !a.size) continue;
      const key = `${a.type.trim().toUpperCase()}|${a.series ?? 'null'}|${a.size.trim().toUpperCase()}`;
      articleMap.set(key, { code: a.code, description: a.description });
    }

    // Add Tapa articles (type is null, match by code prefix TA + description pattern)
    for (const a of allArticles) {
      if (!a.code.startsWith('TA') || !a.size) continue;
      if (!a.description.toLowerCase().includes('tapa')) continue;
      const isBSPT = a.description.toUpperCase().includes('BSPT');
      const isNPT = a.description.toUpperCase().includes('NPT');
      const syntheticType = isBSPT ? '__TAPA_BSPT__' : isNPT ? '__TAPA_NPT__' : null;
      if (!syntheticType) continue;
      const key = `${syntheticType}|${a.series ?? 'null'}|${a.size.trim().toUpperCase()}`;
      articleMap.set(key, { code: a.code, description: a.description });
    }

    // Also build a map without series for fallback (studs, nuts have series=null)
    const articleMapNoSeries = new Map<string, { code: string; description: string }>();
    for (const a of allArticles) {
      if (!a.type || !a.size) continue;
      const key = `${a.type.trim().toUpperCase()}|${a.size.trim().toUpperCase()}`;
      if (!articleMapNoSeries.has(key)) {
        articleMapNoSeries.set(key, { code: a.code, description: a.description });
      }
    }

    // 2. Read Excel
    const wb = XLSX.readFile(INPUT);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // 3. Parse hierarchically and add codes
    let currentProduct = '';
    let currentSeries: number | null = null;
    let currentThread = '';
    let inStudsSection = false;
    let inNutsSection = false;
    let matched = 0;
    let unmatched = 0;
    let skipped = 0;
    const orderLines: { code: string; quantity: number; description: string }[] = [];

    // We'll add 2 new columns: G (col index 6) and H (col index 7) for fittings
    // For studs section: cols I (8) and J (9)
    const CODE_COL_FITTINGS = 6; // G
    const DESC_COL_FITTINGS = 7; // H
    const CODE_COL_STUDS = 8; // I
    const DESC_COL_STUDS = 9; // J

    // Add headers
    data[5] = data[5] || [];
    data[5][CODE_COL_FITTINGS] = 'Codigo SPISA';
    data[5][DESC_COL_FITTINGS] = 'Descripcion SPISA';

    // Studs header row
    if (data[301]) {
      data[301][CODE_COL_STUDS] = 'Codigo SPISA';
      data[301][DESC_COL_STUDS] = 'Descripcion SPISA';
    }

    for (let i = 7; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const cellA = row[0] != null ? String(row[0]).trim() : '';
      const cellB = row[1] != null ? String(row[1]).trim() : '';
      const cellC = row[2] != null ? String(row[2]).trim() : '';

      // Detect studs section
      if (cellA.toUpperCase().includes('STUD BOLT') || cellB.includes('Quotation for Studs')) {
        inStudsSection = true;
        inNutsSection = false;
        continue;
      }
      if (cellB.toUpperCase().includes('HEAVY NUT') || cellB.toUpperCase().includes('HEAVY NUTS')) {
        inNutsSection = true;
        inStudsSection = false;
        continue;
      }

      // ── STUDS & NUTS section ──
      if (inStudsSection || inNutsSection) {
        // Data rows have size in column C and qty in column D
        if (
          !cellC ||
          cellC === 'Description' ||
          cellC.includes('TOTAL') ||
          cellC.includes('DIALFA')
        )
          continue;

        const rawSize = cellC;
        const qty = row[3];

        let dbType: string;
        let normSize: string;

        if (inNutsSection) {
          dbType = 'Heavy Nuts, A194-2H';
          normSize = normaliseSize(rawSize).toUpperCase();
        } else {
          dbType = 'Stud bolt, A193-B7';
          normSize = normaliseStudSize(rawSize).toUpperCase();
        }

        const key = `${dbType.toUpperCase()}|${normSize}`;
        const found = articleMapNoSeries.get(key);

        if (found) {
          row[CODE_COL_STUDS] = found.code;
          row[DESC_COL_STUDS] = found.description;
          matched++;
          const q = Number(qty);
          if (q > 0)
            orderLines.push({ code: found.code, quantity: q, description: found.description });
        } else {
          console.log(
            `NOT FOUND [${inNutsSection ? 'NUT' : 'STUD'}]: size="${rawSize}" → normalised="${normSize}" key="${key}"`
          );
          unmatched++;
        }
        continue;
      }

      // ── FITTINGS section ──

      // Detect product headers
      const upperA = cellA.toUpperCase();
      if (upperA.includes('ELBOW 90')) {
        currentProduct = 'ELBOW 90º';
        currentSeries = null;
        currentThread = '';
        continue;
      }
      if (upperA.includes('ELBOW 45')) {
        currentProduct = 'ELBOW 45º';
        currentSeries = null;
        currentThread = '';
        continue;
      }
      if (upperA === 'TEE') {
        currentProduct = 'TEE';
        currentSeries = null;
        currentThread = '';
        continue;
      }
      if (upperA.includes('UNION')) {
        currentProduct = 'UNION';
        currentSeries = null;
        currentThread = '';
        continue;
      }
      if (upperA.includes('COUPLING')) {
        currentProduct = 'COUPLING';
        currentSeries = null;
        currentThread = '';
        continue;
      }
      if (upperA.includes('CAP') && !upperA.includes('CASQ')) {
        currentProduct = 'CAP';
        currentSeries = null;
        currentThread = '';
        continue;
      }
      if (upperA.includes('HEX HEAD PLUG')) {
        currentProduct = 'HEX HEAD PLUG';
        currentSeries = null;
        currentThread = '';
        continue;
      }
      if (upperA.includes('HEX HEAD BUSHING') || upperA.includes('BUSHING')) {
        currentProduct = 'HEX HEAD BUSHING';
        currentSeries = null;
        currentThread = '';
        continue;
      }
      if (upperA.includes('HEX THD NIPPLE') || upperA.includes('NIPPLE')) {
        currentProduct = 'HEX THD NIPPLE';
        currentSeries = null;
        currentThread = '';
        continue;
      }

      // Detect series headers (may also contain thread in col B on the same row)
      if (
        upperA.includes('S-2000') ||
        upperA.includes('S-3000') ||
        upperA.replace(/\s/g, '') === 'S-2000' ||
        upperA.replace(/\s/g, '') === 'S-3000'
      ) {
        if (upperA.includes('S-2000') || upperA.replace(/\s/g, '') === 'S-2000')
          currentSeries = 2000;
        if (upperA.includes('S-3000') || upperA.replace(/\s/g, '') === 'S-3000')
          currentSeries = 3000;
        // Also check if thread is on the same row (col B)
        const uB = cellB.toUpperCase();
        if (uB.includes('BSPT') || uB.includes('NPT') || uB.includes('SW') || uB.includes('SCH')) {
          currentThread = cellB.trim();
        }
        continue;
      }

      // Detect thread headers (usually in column B)
      const upperB = cellB.toUpperCase();
      if (
        upperB.includes('BSPT') ||
        upperB.includes('NPT') ||
        upperB.includes('SW') ||
        upperB.includes('SCH')
      ) {
        currentThread = cellB.trim();
        // Sometimes series is in the same row as thread (e.g., "S-3000" in A, "BSPT" in B)
        if (upperA.includes('S-3000')) currentSeries = 3000;
        if (upperA.includes('S-2000')) currentSeries = 2000;
        continue;
      }

      // Data rows: col A has size (string like "1/2\"" or number like 0.5), col B has quantity
      const rawSizeA = row[0];
      if (rawSizeA == null || rawSizeA === '' || cellA === ' ') continue;
      // Skip non-data rows (headers, totals)
      if (
        upperA.includes('TOTAL') ||
        upperA.includes('FORGED') ||
        upperA.includes('DESCRIPTION') ||
        upperA.includes('OFFER') ||
        upperA.includes('QINGDAO') ||
        upperA.includes('NO.')
      )
        continue;
      if (upperA.includes('FOB') || upperA.includes('KGS') || upperA.includes('USD')) continue;

      // This should be a data row with a size
      if (!currentProduct || !currentThread) {
        continue;
      }

      const mapping = getDbType(currentProduct, currentThread, currentSeries);
      if (!mapping) {
        skipped++;
        continue;
      }

      let normSize: string;
      if (currentProduct === 'HEX HEAD BUSHING') {
        normSize = normaliseBushingSize(rawSizeA);
      } else {
        normSize = normaliseSize(rawSizeA);
      }

      // Try with series first
      const keyWithSeries = `${mapping.type.toUpperCase()}|${mapping.series}|${normSize.toUpperCase()}`;
      let found = articleMap.get(keyWithSeries);

      // Fallback: try without series (null)
      if (!found) {
        const keyNoSeries = `${mapping.type.toUpperCase()}|null|${normSize.toUpperCase()}`;
        found = articleMap.get(keyNoSeries);
      }

      // Fallback: try common series (3000, 2000) when series is null
      if (!found) {
        for (const s of [3000, 2000, 6000]) {
          const key = `${mapping.type.toUpperCase()}|${s}|${normSize.toUpperCase()}`;
          found = articleMap.get(key);
          if (found) break;
        }
      }

      // Fallback: try with type only (no series filter)
      if (!found) {
        const keyTypeSize = `${mapping.type.toUpperCase()}|${normSize.toUpperCase()}`;
        found = articleMapNoSeries.get(keyTypeSize);
      }

      if (found) {
        row[CODE_COL_FITTINGS] = found.code;
        row[DESC_COL_FITTINGS] = found.description;
        matched++;
        const q = Number(row[1]); // quantity in col B for fittings
        if (q > 0)
          orderLines.push({ code: found.code, quantity: q, description: found.description });
      } else {
        console.log(
          `NOT FOUND [${currentProduct}]: series=${currentSeries} thread="${currentThread}" size="${rawSizeA}" → norm="${normSize}" key="${keyWithSeries}"`
        );
        unmatched++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Matched: ${matched}`);
    console.log(`Not found: ${unmatched}`);
    console.log(`Skipped (no DB type mapping): ${skipped}`);

    // 4. Write CSV with order lines (qty > 0)
    const csvHeader = 'code,quantity,description';
    const csvRows = orderLines.map(
      (l) => `${l.code},${l.quantity},"${l.description.replace(/"/g, '""')}"`
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');
    fs.writeFileSync(CSV_OUTPUT, csvContent, 'utf-8');
    console.log(`\nCSV written to: ${CSV_OUTPUT}`);
    console.log(`Order lines (qty > 0): ${orderLines.length}`);

    // 5. Write Excel output
    try {
      const newWs = XLSX.utils.aoa_to_sheet(data);
      newWs['!cols'] = [
        { wch: 20 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
        { wch: 45 },
        { wch: 16 },
        { wch: 45 },
      ];
      const newWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWb, newWs, 'PRICE');
      XLSX.writeFile(newWb, OUTPUT);
      console.log(`Excel written to: ${OUTPUT}`);
    } catch (e: any) {
      console.log(`Excel write skipped (file locked?): ${e.message}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
