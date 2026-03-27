import axios from 'axios';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Article } from '@/types/article';

interface CsvLine {
  code: string;
  quantity: number;
}

interface ImportResult {
  imported: number;
  notFound: string[];
}

/**
 * Hook to import a CSV file (code,quantity) into a supplier order draft.
 * Uses addItems (bulk) to add all matched articles in a single state update.
 */
export function useImportCsvToOrder(
  addItems: (entries: { article: Article; quantity: number }[]) => void,
  trendMonths: number = 12
) {
  const [isImporting, setIsImporting] = useState(false);

  const parseCsv = (text: string): CsvLine[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return [];

    const result: CsvLine[] = [];
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length < 2) continue;

      const code = parts[0].trim().replace(/^["']|["']$/g, '');
      const qty = Number(parts[1].trim().replace(/^["']|["']$/g, ''));

      // Skip header row
      if (isNaN(qty) || code.toLowerCase() === 'code') continue;
      if (qty <= 0) continue;

      result.push({ code, quantity: qty });
    }
    return result;
  };

  const importCsv = useCallback(
    async (file: File): Promise<ImportResult | null> => {
      setIsImporting(true);
      try {
        const text = await file.text();
        const lines = parseCsv(text);

        if (lines.length === 0) {
          toast.error('CSV vacío o formato inválido');
          return null;
        }

        // Look up all articles by code in one request
        const codes = lines.map((l) => l.code).join(',');
        const response = await axios.get('/api/articles', {
          params: {
            codes,
            includeTrends: 'true',
            includeLastSaleDate: 'true',
            trendMonths,
          },
        });

        const articles: Article[] = response.data.data;
        const articleByCode = new Map<string, Article>();
        for (const a of articles) {
          articleByCode.set(a.code.toUpperCase(), a);
        }

        const notFound: string[] = [];
        const entries: { article: Article; quantity: number }[] = [];

        for (const line of lines) {
          const article = articleByCode.get(line.code.toUpperCase());
          if (article) {
            entries.push({ article, quantity: line.quantity });
          } else {
            notFound.push(line.code);
          }
        }

        // Bulk add — single state update + single debounced save
        if (entries.length > 0) {
          addItems(entries);
        }

        const result = { imported: entries.length, notFound };

        if (entries.length > 0) {
          toast.success(`${entries.length} artículos importados`);
        }
        if (notFound.length > 0) {
          toast.warning(
            `${notFound.length} códigos no encontrados: ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? '...' : ''}`
          );
        }

        return result;
      } catch (error) {
        toast.error('Error al importar CSV');
        return null;
      } finally {
        setIsImporting(false);
      }
    },
    [addItems, trendMonths]
  );

  return { importCsv, isImporting };
}
