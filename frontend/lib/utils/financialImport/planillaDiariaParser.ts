import * as XLSX from 'xlsx';
import type { ParsedCostRow, ParseResult } from './types';

/**
 * Categorize a SALIDA concept from planilla diaria
 */
function categorize(concept: string): string {
  const upper = concept.toUpperCase().trim();

  if (upper.includes('SUELDO')) return 'negro_sueldos';
  if (upper === 'DIEGO' || upper.startsWith('DIEGO ')) return 'negro_diego';
  if (upper.includes('CAJA CHICA')) return 'negro_caja_chica';
  if (upper.includes('FLETE') || upper.includes('TAXI')) return 'negro_fletes';

  return 'negro_otros';
}

/**
 * Convert Excel serial date or Date object to YYYY-MM string
 */
function toYearMonth(value: unknown): string | null {
  if (!value) return null;

  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    // Excel serial date
    date = new Date((value - 25569) * 86400 * 1000);
  } else if (typeof value === 'string') {
    date = new Date(value);
  }

  if (!date || isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function parsePlanillaDiaria(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  // Aggregate: { "2026-01|negro_sueldos": totalAmount }
  const agg = new Map<string, number>();

  // SALIDA entries: col E (4)=date, col F (5)=concept, col G (6)=amount
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row) continue;

    const dateVal = row[4]; // Column E
    const concept = row[5]; // Column F
    const amount = row[6]; // Column G

    if (!dateVal || !concept || !amount) continue;

    const yearMonth = toYearMonth(dateVal);
    if (!yearMonth) continue;

    const amountNum = typeof amount === 'number' ? amount : parseFloat(String(amount));
    if (isNaN(amountNum) || amountNum <= 0) continue;

    const category = categorize(String(concept));
    const key = `${yearMonth}|${category}`;
    agg.set(key, (agg.get(key) || 0) + amountNum);
  }

  const rows: ParsedCostRow[] = [];
  for (const [key, total] of agg.entries()) {
    const [yearMonth, category] = key.split('|');
    rows.push({
      yearMonth,
      source: 'planilla_diaria',
      category,
      amountArs: Math.round(total * 100) / 100,
    });
  }

  rows.sort(
    (a, b) => a.yearMonth.localeCompare(b.yearMonth) || a.category.localeCompare(b.category)
  );

  const monthsDetected = [...new Set(rows.map((r) => r.yearMonth))].sort();

  return {
    rows,
    summary: {
      monthsDetected,
      totalRows: rows.length,
      source: 'planilla_diaria',
    },
  };
}
