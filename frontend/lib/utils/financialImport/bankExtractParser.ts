import * as XLSX from 'xlsx';
import type { ParsedCostRow, ParseResult } from './types';

// Map row labels (from column A) to category keys
const LABEL_TO_CATEGORY: Record<string, string> = {
  'Acreditación Valores/Cheques': 'income_checks',
  'Acreditacion Valores/Cheques': 'income_checks',
  'Transferencias Recibidas': 'income_transfers',
  'Sueldo Diego': 'diego_salary',
  'Tarjeta de Crédito': 'diego_credit_card',
  'Tarjeta de Credito': 'diego_credit_card',
  'Educación (Colegio)': 'diego_education',
  'Educacion (Colegio)': 'diego_education',
  'Inmobiliario / Propiedades': 'diego_property',
  'Transferencias Personales': 'diego_transfers',
  'Pagos Personales': 'diego_payments',
  'Sueldos Personal': 'opex_salaries',
  'ARCA - Obligaciones Fiscales': 'opex_arca',
  'AFIP - Débito Directo': 'opex_afip',
  'AFIP - Debito Directo': 'opex_afip',
  'Servicios (Luz/Gas/Agua/Telecom)': 'opex_services',
  'Mantenimiento Cuenta / Seguros': 'opex_insurance',
  'Tasas Municipales': 'opex_municipal',
  'Impuestos s/Actividad': 'opex_var_taxes',
  'Comisiones Bancarias': 'opex_var_commissions',
};

// Month name abbreviations in Spanish → month number
const MONTH_ABBR: Record<string, string> = {
  Ene: '01',
  Feb: '02',
  Mar: '03',
  Abr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Ago: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dic: '12',
};

/**
 * Parse "Ene-2026" → "2026-01"
 */
function parseMonthHeader(header: string): string | null {
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^(\w{3})-(\d{4})$/);
  if (!match) return null;
  const monthNum = MONTH_ABBR[match[1]];
  if (!monthNum) return null;
  return `${match[2]}-${monthNum}`;
}

export function parseBankExtract(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName =
    workbook.SheetNames.find(
      (n) => n.toLowerCase().includes('dashboard') || n.toLowerCase().includes('anual')
    ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const data: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  // Row 4 (index 3) has month headers starting at column B (index 1)
  const headerRow = data[3];
  if (!headerRow) throw new Error('No se encontró la fila de encabezados (fila 4)');

  // Parse month columns
  const monthColumns: { colIndex: number; yearMonth: string }[] = [];
  for (let col = 1; col < headerRow.length; col++) {
    const cellValue = headerRow[col];
    if (cellValue && typeof cellValue === 'string') {
      const ym = parseMonthHeader(cellValue.trim());
      if (ym) monthColumns.push({ colIndex: col, yearMonth: ym });
    }
  }

  if (monthColumns.length === 0) {
    throw new Error('No se detectaron columnas de meses en la fila 4 (esperado: "Ene-2026", etc.)');
  }

  const rows: ParsedCostRow[] = [];

  // Iterate all data rows looking for category labels
  for (let rowIdx = 4; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    if (!row || !row[0]) continue;

    const label = String(row[0]).trim();
    const category = LABEL_TO_CATEGORY[label];
    if (!category) continue;

    for (const { colIndex, yearMonth } of monthColumns) {
      const value = row[colIndex];
      if (value === null || value === undefined || value === 0) continue;
      const amount = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(amount) || amount === 0) continue;

      rows.push({
        yearMonth,
        source: 'bank_extract',
        category,
        amountArs: Math.round(amount * 100) / 100,
      });
    }
  }

  const monthsDetected = [...new Set(rows.map((r) => r.yearMonth))].sort();

  return {
    rows,
    summary: {
      monthsDetected,
      totalRows: rows.length,
      source: 'bank_extract',
    },
  };
}
