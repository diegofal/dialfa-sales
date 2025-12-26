/**
 * Bestflow Proforma Extractor
 * Extracts product data from Bestflow Excel files
 */

import * as XLSX from 'xlsx';
import { ExtractedItem, ExtractedProforma, ProformaMetadata } from './types';

// Excel row cell value type
type CellValue = string | number | boolean | Date | null | undefined;

export class BestflowExtractor {
  // Based on analysis, header is at row 8, data starts at row 11
  private readonly HEADER_ROW = 8;
  private readonly DATA_START_ROW = 11;

  // Column indices from analysis
  private readonly COL_ITEM_NUMBER = 0; // Item #
  private readonly COL_DESCRIPTION = 1; // Description
  private readonly COL_SIZE = 2; // Size
  private readonly COL_QUANTITY = 3; // Quantity
  private readonly COL_UNIT_WEIGHT = 4; // Unit Weight
  private readonly COL_UNIT_PRICE = 5; // Unit Price
  private readonly COL_TOTAL = 6; // Total

  async extract(fileBuffer: Buffer, fileName: string): Promise<ExtractedProforma> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON with all rows (no header)
    const rows: CellValue[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    // Extract metadata from the first few rows
    const metadata = this.extractMetadata(rows, fileName);

    // Extract items
    const items: ExtractedItem[] = [];

    for (let i = this.DATA_START_ROW; i < rows.length; i++) {
      const row = rows[i];

      // Stop if we encounter a row that looks like a subtotal or end
      if (this.isEndRow(row)) {
        break;
      }

      // Skip empty rows
      if (this.isEmptyRow(row)) {
        continue;
      }

      // Skip section headers (like "CARBON STEEL FLANGES")
      if (this.isSectionHeader(row)) {
        continue;
      }

      const item = this.extractItem(row, i);
      if (item) {
        items.push(item);
      }
    }

    return {
      metadata,
      items,
      summary: {
        totalRows: rows.length,
        extractedRows: items.length,
      },
    };
  }

  private extractMetadata(rows: CellValue[][], fileName: string): ProformaMetadata {
    let proformaNumber = '';
    let date = '';

    // Search in first 10 rows for proforma number and date
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const rowStr = rows[i].join(' ').toUpperCase();

      // Look for proforma number (e.g., "PIF25159")
      if (!proformaNumber && /PIF\d+|PI[\d-]+/i.test(rowStr)) {
        const match = rowStr.match(/PIF\d+|PI[\d-]+/i);
        if (match) {
          proformaNumber = match[0];
        }
      }

      // Look for date
      if (!date) {
        // Try various date formats
        const dateMatch = rowStr.match(
          /\d{4}[.-]\d{1,2}[.-]\d{1,2}|\d{1,2}[.-]\d{1,2}[.-]\d{4}|[A-Z]{3,9}[.\s,]\d{1,2}[,\s]\d{4}/i
        );
        if (dateMatch) {
          date = dateMatch[0];
        }
      }
    }

    return {
      supplier: 'Bestflow',
      proformaNumber: proformaNumber || 'Unknown',
      date,
      fileName,
    };
  }

  private extractItem(row: CellValue[], rowNumber: number): ExtractedItem | null {
    try {
      const itemNumber = row[this.COL_ITEM_NUMBER]?.toString().trim() || '';
      const description = row[this.COL_DESCRIPTION]?.toString().trim() || '';
      const size = row[this.COL_SIZE]?.toString().trim() || '';
      const quantity = this.parseNumber(row[this.COL_QUANTITY]);
      const unitWeight = this.parseNumber(row[this.COL_UNIT_WEIGHT]);
      const unitPrice = this.parseNumber(row[this.COL_UNIT_PRICE]);
      const totalPrice = this.parseNumber(row[this.COL_TOTAL]);

      // Validate required fields
      if (!description || quantity <= 0 || unitPrice <= 0) {
        return null;
      }

      return {
        rowNumber,
        itemNumber,
        description,
        size,
        quantity,
        unitWeight,
        unitPrice,
        totalPrice,
        rawData: Object.fromEntries(row.map((cell, idx) => [idx.toString(), cell])),
      };
    } catch (error) {
      console.error(`Error extracting item from row ${rowNumber}:`, error);
      return null;
    }
  }

  private parseNumber(value: CellValue): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const num = parseFloat(value.toString().replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  }

  private isEmptyRow(row: CellValue[]): boolean {
    return row.every((cell) => !cell || cell.toString().trim() === '');
  }

  private isSectionHeader(row: CellValue[]): boolean {
    // Section headers typically have text in description column but no item number
    const hasDescription = row[this.COL_DESCRIPTION]?.toString().trim();
    const hasItemNumber = row[this.COL_ITEM_NUMBER]?.toString().trim();
    const hasQuantity = this.parseNumber(row[this.COL_QUANTITY]) > 0;

    return !!hasDescription && !hasItemNumber && !hasQuantity;
  }

  private isEndRow(row: CellValue[]): boolean {
    const rowStr = row.join(' ').toUpperCase();
    return (
      rowStr.includes('TOTAL') ||
      rowStr.includes('SUBTOTAL') ||
      rowStr.includes('GRAND TOTAL') ||
      rowStr.includes('BANK') ||
      rowStr.includes('REMARK')
    );
  }
}

