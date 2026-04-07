/**
 * CSV Proforma Extractor
 * Parses normalized CSV files into ExtractedProforma format.
 *
 * CSV must have fixed column headers (case-insensitive):
 *   description (required), size (required), quantity (required),
 *   unit_price (required), total_price, unit_weight, item_number
 *
 * Metadata is extracted from filename convention:
 *   {Supplier}_{ProformaNumber}_{YYYY-MM-DD}.csv
 *   e.g. "Bestflow_PIF25159_2026-04-07.csv"
 */

import { ExtractedItem, ExtractedProforma, ProformaMetadata } from './types';

interface ColumnMap {
  description: number;
  size: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_weight: number;
  item_number: number;
}

const REQUIRED_COLUMNS = ['description', 'size', 'quantity', 'unit_price'] as const;

const COLUMN_ALIASES: Record<string, keyof ColumnMap> = {
  description: 'description',
  descripcion: 'description',
  desc: 'description',
  size: 'size',
  medida: 'size',
  quantity: 'quantity',
  qty: 'quantity',
  cantidad: 'quantity',
  unit_price: 'unit_price',
  unitprice: 'unit_price',
  precio_unitario: 'unit_price',
  total_price: 'total_price',
  totalprice: 'total_price',
  total: 'total_price',
  precio_total: 'total_price',
  unit_weight: 'unit_weight',
  unitweight: 'unit_weight',
  weight: 'unit_weight',
  peso: 'unit_weight',
  peso_unitario: 'unit_weight',
  item_number: 'item_number',
  itemnumber: 'item_number',
  item: 'item_number',
  numero: 'item_number',
};

export class CsvExtractor {
  async extract(fileBuffer: Buffer, fileName: string): Promise<ExtractedProforma> {
    const content = fileBuffer.toString('utf-8');
    const lines = this.parseCSVLines(content);

    if (lines.length === 0) {
      throw new Error('El archivo CSV está vacío o no tiene datos');
    }

    const headerRow = lines[0];
    const columnMap = this.resolveColumns(headerRow);
    this.validateRequiredColumns(columnMap);

    const metadata = this.extractMetadataFromFilename(fileName);
    const items: ExtractedItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (row.every((cell) => !cell.trim())) continue;

      const item = this.extractItem(row, columnMap, i + 1);
      if (item) {
        items.push(item);
      }
    }

    return {
      metadata,
      items,
      summary: {
        totalRows: lines.length - 1,
        extractedRows: items.length,
      },
    };
  }

  private resolveColumns(headerRow: string[]): ColumnMap {
    const map: ColumnMap = {
      description: -1,
      size: -1,
      quantity: -1,
      unit_price: -1,
      total_price: -1,
      unit_weight: -1,
      item_number: -1,
    };

    for (let i = 0; i < headerRow.length; i++) {
      const header = headerRow[i]
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      const mapped = COLUMN_ALIASES[header];
      if (mapped && map[mapped] === -1) {
        map[mapped] = i;
      }
    }

    return map;
  }

  private validateRequiredColumns(columnMap: ColumnMap): void {
    const missing = REQUIRED_COLUMNS.filter((col) => columnMap[col] === -1);
    if (missing.length > 0) {
      throw new Error(
        `Columnas requeridas no encontradas: ${missing.join(', ')}. ` +
          `El CSV debe tener: ${REQUIRED_COLUMNS.join(', ')}`
      );
    }
  }

  private extractItem(
    row: string[],
    columnMap: ColumnMap,
    rowNumber: number
  ): ExtractedItem | null {
    const description = this.getCellValue(row, columnMap.description);
    const size = this.getCellValue(row, columnMap.size);
    const quantity = this.parseNumber(this.getCellValue(row, columnMap.quantity));
    const unitPrice = this.parseNumber(this.getCellValue(row, columnMap.unit_price));

    if (!description || quantity <= 0 || unitPrice <= 0) {
      return null;
    }

    const totalPrice =
      columnMap.total_price >= 0
        ? this.parseNumber(this.getCellValue(row, columnMap.total_price))
        : quantity * unitPrice;

    const unitWeight =
      columnMap.unit_weight >= 0
        ? this.parseNumber(this.getCellValue(row, columnMap.unit_weight))
        : 0;

    const itemNumber =
      columnMap.item_number >= 0
        ? this.getCellValue(row, columnMap.item_number)
        : rowNumber.toString();

    const rawData: Record<string, unknown> = {};
    for (let i = 0; i < row.length; i++) {
      rawData[i.toString()] = row[i];
    }

    return {
      rowNumber,
      itemNumber,
      description,
      size,
      quantity,
      unitWeight,
      unitPrice,
      totalPrice: totalPrice || quantity * unitPrice,
      rawData,
    };
  }

  private getCellValue(row: string[], index: number): string {
    if (index < 0 || index >= row.length) return '';
    return row[index].trim();
  }

  private parseNumber(value: string): number {
    if (!value) return 0;
    const num = parseFloat(value.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  }

  extractMetadataFromFilename(fileName: string): ProformaMetadata {
    // Remove extension
    const baseName = fileName.replace(/\.[^.]+$/, '');

    // Try convention: Supplier_ProformaNumber_YYYY-MM-DD
    const parts = baseName.split('_');

    if (parts.length >= 2) {
      const supplier = parts[0];
      const proformaNumber = parts[1];
      const date = parts.length >= 3 ? parts.slice(2).join('_') : undefined;

      return {
        supplier,
        proformaNumber,
        date,
        fileName,
      };
    }

    // Fallback: use filename as supplier
    return {
      supplier: baseName,
      proformaNumber: 'Unknown',
      fileName,
    };
  }

  /**
   * Parse CSV content handling quoted fields, commas within quotes, and newlines within quotes.
   * Only enters quoted mode when " is at the very start of a field (per RFC 4180).
   */
  private parseCSVLines(content: string): string[][] {
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let atFieldStart = true;
    let i = 0;

    while (i < content.length) {
      const char = content[i];

      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < content.length && content[i + 1] === '"') {
            currentField += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          currentField += char;
          i++;
        }
      } else {
        if (char === '"' && atFieldStart) {
          inQuotes = true;
          atFieldStart = false;
          i++;
        } else if (char === ',') {
          currentRow.push(currentField);
          currentField = '';
          atFieldStart = true;
          i++;
        } else if (char === '\n' || char === '\r') {
          currentRow.push(currentField);
          currentField = '';
          atFieldStart = true;
          if (currentRow.some((cell) => cell.trim())) {
            lines.push(currentRow);
          }
          currentRow = [];
          if (char === '\r' && i + 1 < content.length && content[i + 1] === '\n') {
            i += 2;
          } else {
            i++;
          }
        } else {
          currentField += char;
          atFieldStart = false;
          i++;
        }
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some((cell) => cell.trim())) {
        lines.push(currentRow);
      }
    }

    return lines;
  }
}
