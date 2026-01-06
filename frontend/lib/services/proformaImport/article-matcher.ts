/**
 * Article Matcher
 * Maps extracted proforma items to database articles
 */

import { PrismaClient } from '@prisma/client';
import { ExtractedItem, ArticleForMatching, MatchedArticle } from './types';
import { MatchingKeyNormalizer } from './matching-normalizer';

export class ArticleMatcher {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async matchItems(extractedItems: ExtractedItem[]): Promise<MatchedArticle[]> {
    // Load all active articles from database
    const articles = await this.loadArticles();

    // Build index by matching key for fast lookup
    const articleIndex = this.buildArticleIndex(articles);

    // Match each extracted item
    const matched: MatchedArticle[] = [];

    for (const item of extractedItems) {
      const matchResult = this.matchSingleItem(item, articleIndex);
      matched.push(matchResult);
    }

    return matched;
  }

  private async loadArticles(): Promise<ArticleForMatching[]> {
    const articles = await this.prisma.articles.findMany({
      where: {
        is_active: true,
        // Include discontinued articles - they can still be matched
        deleted_at: null,
      },
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        series: true,
        thickness: true,
        size: true,
        stock: true,
        minimum_stock: true,
        unit_price: true,
      },
    });

    return articles.map((a) => ({
      id: Number(a.id),
      code: a.code,
      description: a.description,
      type: a.type,
      series: a.series,
      thickness: a.thickness,
      size: a.size,
      stock: parseFloat(a.stock.toString()),
      minimumStock: parseFloat(a.minimum_stock.toString()),
      unitPrice: parseFloat(a.unit_price.toString()),
    }));
  }

  private buildArticleIndex(articles: ArticleForMatching[]): Map<string, ArticleForMatching> {
    const index = new Map<string, ArticleForMatching>();

    for (const article of articles) {
      if (!article.type || !article.size) {
        continue;
      }

      const matchingKey = MatchingKeyNormalizer.createMatchingKey({
        type: article.type,
        thickness: article.thickness || '',
        size: article.size,
        series: article.series || undefined,
      });

      if (matchingKey && !index.has(matchingKey)) {
        index.set(matchingKey, article);
      }
    }

    return index;
  }

  private matchSingleItem(
    item: ExtractedItem,
    articleIndex: Map<string, ArticleForMatching>
  ): MatchedArticle {
    // Try to extract type, series, thickness, and size from the item
    const type = MatchingKeyNormalizer.extractTypeFromDescription(item.description);
    const series = MatchingKeyNormalizer.extractSeriesFromDescription(item.description);
    const thickness = this.extractThicknessFromDescription(item.description);
    const normalizedSize = MatchingKeyNormalizer.normalizeSize(item.size);

    const debugInfo = {
      extractedType: type,
      extractedSeries: series?.toString() || '',
      extractedThickness: thickness,
      extractedSize: normalizedSize,
    };

    // Try multiple matching strategies
    const matchingStrategies = [
      // Strategy 1: Exact match with extracted values (including series)
      () => {
        const key = MatchingKeyNormalizer.createMatchingKey({
          type,
          thickness,
          size: item.size,
          series: series || undefined,
          description: item.description,
        });
        return key && articleIndex.has(key) ? { key, article: articleIndex.get(key)! } : null;
      },
      // Strategy 2: Try without thickness if it's empty
      () => {
        if (!thickness) {
          // Try with common thickness values
          for (const t of ['', 'STD', 'XS']) {
            const key = MatchingKeyNormalizer.createMatchingKey({
              type,
              thickness: t,
              size: item.size,
              series: series || undefined,
              description: item.description,
            });
            if (key && articleIndex.has(key)) {
              return { key, article: articleIndex.get(key)! };
            }
          }
        }
        return null;
      },
      // Strategy 3: Try without series if no series found
      () => {
        if (!series) {
          const key = MatchingKeyNormalizer.createMatchingKey({
            type,
            thickness,
            size: item.size,
            description: item.description,
          });
          if (key && articleIndex.has(key)) {
            return { key, article: articleIndex.get(key)! };
          }
        }
        return null;
      },
    ];

    // Try each strategy
    for (const strategy of matchingStrategies) {
      const result = strategy();
      if (result) {
        console.log(`✓ MATCH FOUND for "${item.description}":`, {
          ...debugInfo,
          matchingKey: result.key,
          matchedArticle: result.article.code,
        });
        
        // Calcular valorización
        const valuation = this.calculateValuation(item, result.article);
        
        return {
          extractedItem: item,
          article: result.article,
          confidence: 100,
          matchMethod: 'exact',
          matchingKey: result.key,
          ...valuation,
          debugInfo,
        };
      }
    }

    // No match found - diagnose and log
    const attemptedKey = MatchingKeyNormalizer.createMatchingKey({
      type,
      thickness,
      size: item.size,
      series: series || undefined,
      description: item.description,
    });
    const noMatchReason = this.diagnoseNoMatch(type, series, thickness, normalizedSize, articleIndex);

    console.warn(`✗ NO MATCH for "${item.description}":`, {
      ...debugInfo,
      attemptedMatchingKey: attemptedKey,
      reason: noMatchReason,
    });
    
    // Calcular valorización sin artículo de BD
    const valuation = this.calculateValuation(item, null);

    return {
      extractedItem: item,
      article: null,
      confidence: 0,
      matchMethod: 'none',
      matchingKey: attemptedKey || undefined,
      ...valuation,
      debugInfo: {
        ...debugInfo,
        noMatchReason,
      },
    };
  }

  private extractThicknessFromDescription(description: string): string {
    const desc = description.toUpperCase();

    // For W.N.R.F. flanges, extract the actual schedule number (40, 80) NOT normalized
    if (/W\.N\.R\.F/i.test(desc)) {
      // Check for S.40, S.80, SCH 40, SCH 80, SCH STD
      if (/S\.40|SCH\s*40|SCH\s*STD/i.test(desc)) {
        return '40';
      }
      if (/S\.80|SCH\s*80|SCH\s*XS/i.test(desc)) {
        return '80';
      }
      // If no explicit schedule, return empty string
      return '';
    }

    // For other products (SORF, BLIND, THREADED), use normalized STD/XS
    if (/SCH\s*STD|SCH\s*40|S\.40|S\.\s*40/i.test(desc)) {
      return 'STD';
    }
    if (/SCH\s*XS|SCH\s*80|S\.80|S\.\s*80/i.test(desc)) {
      return 'XS';
    }

    // For S-150, S-300, S-600 series, these are actually the series number, not thickness
    // Don't extract thickness from these - leave it empty or detect from other keywords
    if (/S-150|S-300|S-600/i.test(desc)) {
      // Check if there are other thickness indicators
      if (/XS|EXTRA|PESADO|HEAVY/i.test(desc)) {
        return 'XS';
      }
      // Default to empty string for series - let the DB series field handle it
      return '';
    }

    // Check for XS keywords
    if (/XS|EXTRA|PESADO|HEAVY/i.test(desc)) {
      return 'XS';
    }

    // Default to empty string instead of STD to allow more flexible matching
    return '';
  }

  private diagnoseNoMatch(
    type: string,
    series: number | null,
    thickness: string,
    size: string,
    articleIndex: Map<string, ArticleForMatching>
  ): string {
    if (!type) {
      return 'Could not extract product type from description';
    }

    if (!size) {
      return 'Size is empty or invalid';
    }

    // Find similar keys in the index
    const allKeys = Array.from(articleIndex.keys());
    const similarKeys = allKeys.filter((key) => {
      const parts = key.split('|');
      return (
        parts[0] === type || // Same type
        parts[3] === size || // Same size
        parts[1] === series?.toString() || // Same series
        parts[2] === thickness // Same thickness
      );
    });

    if (similarKeys.length > 0) {
      return `Similar keys found in DB: ${similarKeys.slice(0, 5).join(', ')} (showing first 5)`;
    }

    // Check if type exists at all
    const keysWithType = allKeys.filter((key) => key.startsWith(type + '|'));
    if (keysWithType.length === 0) {
      const availableTypes = new Set(allKeys.map((k) => k.split('|')[0]));
      return `Type "${type}" not found in DB. Available types: ${Array.from(availableTypes)
        .slice(0, 10)
        .join(', ')}`;
    }

    // Check if type+series combo exists
    if (series) {
      const keysWithTypeSeries = allKeys.filter((key) => {
        const parts = key.split('|');
        return parts[0] === type && parts[1] === series.toString();
      });
      if (keysWithTypeSeries.length === 0) {
        return `Type "${type}" exists but not with series ${series}`;
      }
    }

    // Check if size exists for this type+series
    const keysWithTypeSeriesSize = allKeys.filter((key) => {
      const parts = key.split('|');
      return parts[0] === type && parts[1] === (series?.toString() || '') && parts[3] === size;
    });
    if (keysWithTypeSeriesSize.length === 0) {
      return `Type "${type}" ${series ? `series ${series}` : ''} exists but size "${size}" not found`;
    }

    // Must be thickness mismatch
    const availableThickness = keysWithTypeSeriesSize.map((k) => k.split('|')[2]);
    return `Type, series, and size match found, but thickness "${thickness}" not available. Available thickness: ${availableThickness.join(', ')}`;
  }

  /**
   * Calcula valorización: precios, totales y márgenes
   */
  private calculateValuation(
    item: ExtractedItem,
    article: ArticleForMatching | null
  ): {
    proformaUnitPrice: number;
    proformaTotalPrice: number;
    dbUnitPrice: number | null;
    dbTotalPrice: number | null;
    marginAbsolute: number | null;
    marginPercent: number | null;
    unitWeight: number;
  } {
    const proformaUnitPrice = item.unitPrice;
    const proformaTotalPrice = item.totalPrice || item.unitPrice * item.quantity;
    const unitWeight = item.unitWeight || 0;
    
    // Si no hay artículo en BD, no hay precio ni margen
    if (!article) {
      return {
        proformaUnitPrice,
        proformaTotalPrice,
        dbUnitPrice: null,
        dbTotalPrice: null,
        marginAbsolute: null,
        marginPercent: null,
        unitWeight,
      };
    }
    
    const dbUnitPrice = article.unitPrice;
    const dbTotalPrice = dbUnitPrice * item.quantity;
    
    // Margen: (Precio DB / Precio Proforma - 1) * 100
    // Esto da el % de markup/margen sobre el costo de la proforma
    const marginPercent = proformaUnitPrice > 0 
      ? ((dbUnitPrice / proformaUnitPrice - 1) * 100) 
      : null;
    
    const marginAbsolute = dbUnitPrice - proformaUnitPrice;
    
    return {
      proformaUnitPrice,
      proformaTotalPrice,
      dbUnitPrice,
      dbTotalPrice,
      marginAbsolute,
      marginPercent,
      unitWeight,
    };
  }

  async cleanup() {
    await this.prisma.$disconnect();
  }
}

