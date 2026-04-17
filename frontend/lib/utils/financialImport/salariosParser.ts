import * as XLSX from 'xlsx';
import type { ParsedCostRow, ParseResult } from './types';

const MONTH_NAMES: Record<string, number> = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SETIEMBRE: 9,
  SEPTIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

interface SalariosRow {
  monthName: string;
  monthNum: number;
  sueldoTotal: number; // Col G
  aguinaldoTotal: number; // Col D
  total: number; // Col H
  banco: number; // Col I
  efectivo: number; // Col J
  tcSueldo: number; // Col M
}

export function parseSalarios(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  // Parse all salary rows (starting from row 6, index 5)
  const salaryRows: SalariosRow[] = [];

  for (let i = 5; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;

    const monthName = String(row[0]).trim().toUpperCase();
    const monthNum = MONTH_NAMES[monthName];
    if (!monthNum) continue;

    const num = (val: unknown): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      const s = String(val).replace(/[^\d.-]/g, '');
      return parseFloat(s) || 0;
    };

    salaryRows.push({
      monthName,
      monthNum,
      sueldoTotal: num(row[6]), // G
      aguinaldoTotal: num(row[3]), // D
      total: num(row[7]), // H
      banco: num(row[8]), // I
      efectivo: num(row[9]), // J
      tcSueldo: num(row[12]), // M
    });
  }

  if (salaryRows.length === 0) {
    throw new Error('No se encontraron filas de salarios en el archivo');
  }

  // Year detection: last rows = current year, work backwards at DICIEMBRE boundaries
  const currentYear = new Date().getFullYear();
  const years: number[] = new Array(salaryRows.length);

  // Start from the end: assign current year, decrement at each December→January transition (going backwards)
  let year = currentYear;

  // Assign years going backwards from last row
  years[salaryRows.length - 1] = year;
  for (let i = salaryRows.length - 2; i >= 0; i--) {
    const currMonth = salaryRows[i].monthNum;
    const nextMonth = salaryRows[i + 1].monthNum;
    // If current month > next month (e.g., Dec > Jan), we crossed a year boundary going back
    if (currMonth > nextMonth) {
      year--;
    }
    years[i] = year;
  }

  // Build parsed rows
  const rows: ParsedCostRow[] = [];

  for (let i = 0; i < salaryRows.length; i++) {
    const sr = salaryRows[i];
    const y = years[i];
    const m = String(sr.monthNum).padStart(2, '0');
    const yearMonth = `${y}-${m}`;
    const tc = sr.tcSueldo || undefined;

    if (sr.total > 0) {
      rows.push({
        yearMonth,
        source: 'salarios',
        category: 'payroll_total',
        amountArs: Math.round(sr.total * 100) / 100,
        exchangeRate: tc,
        amountUsd: tc ? Math.round((sr.total / tc) * 100) / 100 : undefined,
      });
    }

    if (sr.banco > 0) {
      rows.push({
        yearMonth,
        source: 'salarios',
        category: 'payroll_banco',
        amountArs: Math.round(sr.banco * 100) / 100,
        exchangeRate: tc,
      });
    }

    if (sr.efectivo > 0) {
      rows.push({
        yearMonth,
        source: 'salarios',
        category: 'payroll_efectivo',
        amountArs: Math.round(sr.efectivo * 100) / 100,
        exchangeRate: tc,
      });
    }

    if (sr.aguinaldoTotal > 0) {
      rows.push({
        yearMonth,
        source: 'salarios',
        category: 'payroll_aguinaldo',
        amountArs: Math.round(sr.aguinaldoTotal * 100) / 100,
        exchangeRate: tc,
      });
    }

    // Store exchange rate as reference row
    if (tc && tc > 0) {
      rows.push({
        yearMonth,
        source: 'salarios',
        category: 'payroll_exchange_rate',
        amountArs: 0,
        amountUsd: tc,
        exchangeRate: tc,
      });
    }
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
      source: 'salarios',
    },
  };
}
