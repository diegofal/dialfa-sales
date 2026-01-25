/**
 * Types for proforma import system
 */

export interface ExtractedItem {
  rowNumber: number;
  itemNumber: string;
  description: string;
  size: string;
  quantity: number;
  unitWeight?: number;
  unitPrice: number;
  totalPrice: number;
  rawData: Record<string, unknown>;
}

export interface ProformaMetadata {
  supplier: string;
  proformaNumber: string;
  date?: string;
  fileName: string;
}

export interface ExtractedProforma {
  metadata: ProformaMetadata;
  items: ExtractedItem[];
  summary: {
    totalRows: number;
    extractedRows: number;
  };
}

export interface ArticleForMatching {
  id: number;
  code: string;
  description: string;
  type: string | null;
  series: number | null;
  thickness: string | null;
  size: string | null;
  stock: number;
  minimumStock: number;
  unitPrice: number;
  salesTrend?: number[];
}

export interface MatchedArticle {
  extractedItem: ExtractedItem;
  article: ArticleForMatching | null;
  confidence: number; // 0-100
  matchMethod: 'exact' | 'fuzzy' | 'none';
  matchingKey?: string;

  // Valorización
  proformaUnitPrice: number; // Precio unitario de la proforma (USD)
  proformaTotalPrice: number; // Total de la proforma (USD)
  dbUnitPrice: number | null; // Precio unitario en base de datos (USD)
  dbTotalPrice: number | null; // Total según precio DB (USD)
  marginAbsolute: number | null; // Margen absoluto (USD): DB - Proforma
  marginPercent: number | null; // Margen porcentual (%): (DB/Proforma - 1) * 100
  unitWeight: number; // Peso unitario (kg)

  debugInfo?: {
    extractedType: string;
    extractedSeries?: string;
    extractedThickness: string;
    extractedSize: string;
    reason?: string;
    noMatchReason?: string;
    similarKeys?: string[];
  };
}

export interface ImportResult {
  proforma: ProformaMetadata;
  items: MatchedArticle[];
  summary: {
    total: number;
    matched: number; // confidence >= 70
    needsReview: number; // confidence 50-69
    unmatched: number; // confidence < 50
  };
}

export interface ImportPreviewData extends ImportResult {
  matchedItems: MatchedArticle[];
  unmatchedItems: MatchedArticle[];
}
