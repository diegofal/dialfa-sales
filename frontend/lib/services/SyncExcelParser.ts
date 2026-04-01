import * as XLSX from 'xlsx';
import { ParsedCustomer, ParsedTransaction } from '@/types/sync';

const SHEETS_TO_PROCESS = [0, 1];
const HEADER_ROWS = 4;

/**
 * Parse an Excel workbook buffer and extract customer/transaction data.
 * Ports the logic from SyncPocService/Services/FilesProcessor.cs
 */
export function parseWorkbook(buffer: Buffer): ParsedCustomer[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const customers: ParsedCustomer[] = [];

  for (const sheetIndex of SHEETS_TO_PROCESS) {
    if (sheetIndex >= workbook.SheetNames.length) continue;

    const sheetName = workbook.SheetNames[sheetIndex];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows: (string | number | Date | boolean | null)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });

    if (rows.length === 0) continue;

    // Row 0, Cell[0] = customer name
    const customerName = getCellString(rows[0]?.[0])?.trim();
    if (!customerName) continue;

    const transactions: ParsedTransaction[] = [];

    // Process rows starting at row 4 (skip header rows 0-3)
    for (let i = HEADER_ROWS; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      try {
        if (isValidRow(row)) {
          transactions.push({
            row_num: i,
            invoice_number: getCellString(row[0]),
            invoice_date: getCellDate(row[1]),
            invoice_amount: getCellNumber(row[3]),
            balance: getCellNumber(row[4]) ?? 0,
            payment_receipt: getCellString(row[5]),
            payment_bank: getCellString(row[6]),
            payment_date: getCellDate(row[7]),
            payment_amount: getCellNumber(row[8]),
            type: sheetIndex,
          });
        }
      } catch {
        // Skip invalid rows — errors will be captured at the service level
      }
    }

    // Group by customer name + type (sheet): same customer can appear in both sheets (blanco/negro)
    const existing = customers.find((c) => c.name === customerName && c.type === sheetIndex);
    if (existing) {
      existing.transactions.push(...transactions);
    } else {
      customers.push({
        name: customerName,
        type: sheetIndex,
        transactions,
      });
    }
  }

  return customers;
}

/**
 * A row is valid if:
 * - At least one of cells[2], cells[3], cells[8] has content
 * - Cell[4] (balance) is not null/empty
 */
function isValidRow(row: (string | number | Date | boolean | null)[]): boolean {
  const hasContent = !isEmpty(row[2]) || !isEmpty(row[3]) || !isEmpty(row[8]);
  const hasBalance = !isEmpty(row[4]);
  return hasContent && hasBalance;
}

function isEmpty(value: string | number | Date | boolean | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

function getCellString(value: string | number | Date | boolean | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return String(value).trim() || null;
}

function getCellNumber(value: string | number | Date | boolean | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(parsed) ? null : parsed;
}

function getCellDate(value: string | number | Date | boolean | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'number') {
    // Excel serial date number
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(
        parsed.y,
        parsed.m - 1,
        parsed.d,
        parsed.H || 0,
        parsed.M || 0,
        parsed.S || 0
      );
    }
  }
  return null;
}
