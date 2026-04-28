/**
 * Filter the comparison CSV to only the rows where proforma_max_price
 * differs from articles.last_purchase_price. Adds a source_csv column
 * pointing to the exact proforma file the price came from.
 *
 * Usage: npx tsx scripts/extract-price-differences.ts
 */

import fs from 'fs';
import path from 'path';

const PRIMARY = 'D:\\Pedidos\\Proformas\\comparacion_precios_proforma_vs_db.csv';
const FALLBACK = 'D:\\Pedidos\\Proformas\\comparacion_precios_proforma_vs_db.NEW.csv';
const CSV_DIR = 'D:\\Pedidos\\Proformas\\csvs';
const OUTPUT = 'D:\\Pedidos\\Proformas\\diferencias_precios.csv';

function pickInput(): string {
  if (fs.existsSync(FALLBACK)) {
    const newStat = fs.statSync(FALLBACK);
    if (!fs.existsSync(PRIMARY) || newStat.mtimeMs > fs.statSync(PRIMARY).mtimeMs) {
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

/**
 * Find the CSV file in CSV_DIR whose name contains the given proforma number
 * and date. Falls back to just proforma number if exact date not found.
 */
function findSourceFile(proformaNumber: string, fecha: string): string {
  const all = fs.readdirSync(CSV_DIR).filter((f) => f.toLowerCase().endsWith('.csv'));
  const exact = all.find(
    (f) => f.toUpperCase().includes(proformaNumber.toUpperCase()) && f.includes(fecha)
  );
  if (exact) return path.join(CSV_DIR, exact);
  const partial = all.find((f) => f.toUpperCase().includes(proformaNumber.toUpperCase()));
  return partial ? path.join(CSV_DIR, partial) : '(not found)';
}

function main(): void {
  const inputPath = pickInput();
  console.log(`Reading ${inputPath}...`);
  const raw = stripBom(fs.readFileSync(inputPath, 'utf-8'));
  const rows = parseCsv(raw);

  const header = rows[0].map((h) => h.toLowerCase());
  const idx = (col: string): number => {
    const i = header.indexOf(col);
    if (i < 0) throw new Error(`column missing: ${col}`);
    return i;
  };

  const I = {
    codigo: idx('codigo'),
    descripcion_db: idx('descripcion_db'),
    descripcion_proforma: idx('descripcion_proforma'),
    size_db: idx('size_db'),
    size_proforma: idx('size_proforma'),
    proveedor: idx('proveedor'),
    proforma: idx('proforma'),
    fecha: idx('fecha'),
    proforma_max_price: idx('proforma_max_price'),
    db_last_purchase_price: idx('db_last_purchase_price'),
    diff_abs: idx('diff_abs'),
    diff_pct: idx('diff_pct'),
    status: idx('status'),
  };

  const diffs = rows.slice(1).filter((r) => r[I.status] === 'different');

  // Sort by absolute |diff_pct| descending
  diffs.sort((a, b) => {
    const pa = Math.abs(parseFloat(a[I.diff_pct] || '0'));
    const pb = Math.abs(parseFloat(b[I.diff_pct] || '0'));
    return pb - pa;
  });

  const outRows: (string | number)[][] = diffs.map((r) => {
    const proforma = r[I.proforma];
    const fecha = r[I.fecha];
    const sourceFile = findSourceFile(proforma, fecha);
    const proformaPrice = parseFloat(r[I.proforma_max_price]);
    const dbPrice = parseFloat(r[I.db_last_purchase_price]);
    const direction = proformaPrice > dbPrice ? 'proforma_mayor' : 'db_mayor';
    return [
      r[I.codigo],
      r[I.descripcion_db],
      r[I.descripcion_proforma],
      r[I.size_db],
      r[I.size_proforma],
      r[I.proveedor],
      proforma,
      fecha,
      proformaPrice.toFixed(4),
      dbPrice.toFixed(2),
      r[I.diff_abs],
      r[I.diff_pct],
      direction,
      sourceFile,
    ];
  });

  const writtenPath = writeCsv(
    OUTPUT,
    [
      'codigo',
      'descripcion_db',
      'descripcion_proforma',
      'size_db',
      'size_proforma',
      'proveedor',
      'proforma',
      'fecha',
      'proforma_max_price_USD',
      'db_last_purchase_price_USD',
      'diff_abs_USD',
      'diff_pct',
      'direccion',
      'archivo_origen',
    ],
    outRows
  );

  // Stats
  const propMayor = outRows.filter((r) => r[12] === 'proforma_mayor').length;
  const dbMayor = outRows.filter((r) => r[12] === 'db_mayor').length;

  console.log(`Diferencias filtradas: ${outRows.length}`);
  console.log(`  proforma > db: ${propMayor}`);
  console.log(`  db > proforma: ${dbMayor}`);
  console.log(`Output: ${writtenPath}`);
}

main();
