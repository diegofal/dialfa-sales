import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapArticleToDTO } from '@/lib/utils/mapper';
import { createArticleSchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';
import { getUserFromRequest } from '@/lib/auth/roles';
import { calculateABCClassification } from '@/lib/services/abcClassification';
import { calculateSalesTrends, calculateLastSaleDates } from '@/lib/services/salesTrends';

// Type for articles with categories included
type ArticleWithCategory = {
  id: bigint;
  code: string;
  description: string;
  category_id: bigint;
  stock: unknown;
  minimum_stock: unknown;
  categories: {
    name?: string;
    default_discount_percent?: unknown;
  };
  [key: string]: unknown;
};

// Type for enriched article DTO
type EnrichedArticleDTO = ReturnType<typeof mapArticleToDTO> & {
  abcClass?: string | null;
  salesTrend?: number[];
  salesTrendLabels?: string[];
  lastSaleDate?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId');
    const isActive = searchParams.get('isActive');
    const includeABC = searchParams.get('includeABC') === 'true';
    const abcFilter = searchParams.get('abcFilter'); // 'A', 'B', 'C', or null
    const salesSort = searchParams.get('salesSort'); // 'most', 'least', or null
    const trendMonths = parseInt(searchParams.get('trendMonths') || '12');
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';
    const hasStockOnly = searchParams.get('hasStockOnly') === 'true';
    const zeroStockOnly = searchParams.get('zeroStockOnly') === 'true';
    const ids = searchParams.get('ids'); // Comma-separated list of IDs
    const includeTrends = searchParams.get('includeTrends') === 'true';

    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      deleted_at: null,
    };

    // Filter by specific IDs if provided
    if (ids) {
      const idArray = ids.split(',').map(id => BigInt(id.trim()));
      where.id = { in: idArray };
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.category_id = BigInt(categoryId);
    }

    if (isActive !== null && isActive !== undefined) {
      where.is_active = isActive === 'true';
    }

    // Stock filters
    if (hasStockOnly) {
      where.stock = { gt: 0 };
    } else if (zeroStockOnly) {
      where.stock = { equals: 0 };
    }
    // Note: lowStockOnly is handled in frontend since it requires comparison between fields

    // Get ABC classification and trends if requested
    let abcMap: Map<string, 'A' | 'B' | 'C'> | null = null;
    let trendsData: { data: Map<string, number[]>; labels: string[] } | null = null;
    let lastSaleDates: Map<string, Date | null> | null = null;
    
    if (includeABC || abcFilter || salesSort || includeTrends) {
      try {
        [abcMap, trendsData, lastSaleDates] = await Promise.all([
          calculateABCClassification(),
          calculateSalesTrends(trendMonths),
          calculateLastSaleDates(),
        ]);
      } catch (error) {
        console.error('Error getting ABC/Trends/LastSale classification:', error);
        // Continue without ABC/Trends/LastSale in case of error
      }
    }

    // Get ALL articles first (without pagination) if we need to filter/sort by ABC, sales, or lowStock
    const needsFullDataset = abcFilter || salesSort || lowStockOnly;
    
    let allArticles: ArticleWithCategory[] = [];
    if (needsFullDataset) {
      allArticles = await prisma.articles.findMany({
        where,
        include: {
          categories: true,
        },
      }) as ArticleWithCategory[];
    }

    // Map articles and add ABC/trends data
    const enrichArticle = (article: ArticleWithCategory): EnrichedArticleDTO => {
      const dto = mapArticleToDTO(article) as EnrichedArticleDTO;
      
      if (abcMap) {
        dto.abcClass = abcMap.get(article.id.toString()) || null;
      }
      
      if (trendsData) {
        dto.salesTrend = trendsData.data.get(article.id.toString()) || [];
        dto.salesTrendLabels = trendsData.labels;
      }

      if (lastSaleDates) {
        const lastSale = lastSaleDates.get(article.id.toString());
        dto.lastSaleDate = lastSale ? lastSale.toISOString() : null;
      }
      
      return dto;
    };

    let finalArticles: EnrichedArticleDTO[] = [];
    let totalCount = 0;

    if (needsFullDataset) {
      // Filter by ABC if specified
      let filtered = allArticles;
      if (abcFilter && abcMap) {
        filtered = filtered.filter((article) => {
          const abc = abcMap.get(article.id.toString());
          return abc === abcFilter;
        });
      }

      // Filter by low stock if specified (stock > 0 AND stock < minimum_stock)
      if (lowStockOnly) {
        filtered = filtered.filter((article) => {
          const stock = Number(article.stock);
          const minStock = Number(article.minimum_stock);
          return stock > 0 && stock < minStock;
        });
      }

      // Map to DTOs
      const mappedArticles = filtered.map(enrichArticle);

      // Sort by sales if specified
      if (salesSort && trendsData) {
        mappedArticles.sort((a, b) => {
          const aSales = a.salesTrend?.reduce((sum: number, val: number) => sum + val, 0) || 0;
          const bSales = b.salesTrend?.reduce((sum: number, val: number) => sum + val, 0) || 0;
          
          if (salesSort === 'most') {
            return bSales - aSales; // Descendente
          } else if (salesSort === 'least') {
            return aSales - bSales; // Ascendente
          }
          return 0;
        });
      } else {
        // Default sorting by display_order and code
        mappedArticles.sort((a, b) => {
          const aOrder = a.displayOrder ?? 999999;
          const bOrder = b.displayOrder ?? 999999;
          if (aOrder !== bOrder) {
            return aOrder - bOrder;
          }
          return a.code.localeCompare(b.code);
        });
      }

      totalCount = mappedArticles.length;
      
      // Apply pagination after filtering/sorting
      finalArticles = mappedArticles.slice(skip, skip + limit);
    } else {
      // Normal flow: paginate first, then enrich
      const [articles, total] = await Promise.all([
        prisma.articles.findMany({
          where,
          include: {
            categories: true,
          },
          orderBy: [
            { display_order: 'asc' },
            { code: 'asc' },
          ],
          skip,
          take: limit,
        }),
        prisma.articles.count({ where }),
      ]);

      finalArticles = articles.map(enrichArticle);
      totalCount = total;
    }

    // Handle exact match for search
    if (search && !needsFullDataset) {
      const exactMatch = await prisma.articles.findFirst({
        where: {
          ...where,
          code: { equals: search, mode: 'insensitive' },
        },
        include: {
          categories: true,
        },
      });

      if (exactMatch) {
        const exactMatchDTO = enrichArticle(exactMatch);
        // Remove if already in results
        finalArticles = finalArticles.filter(a => a.id !== exactMatchDTO.id);
        // Add at beginning
        finalArticles.unshift(exactMatchDTO);
        // Trim to limit
        if (finalArticles.length > limit) {
          finalArticles = finalArticles.slice(0, limit);
        }
      }
    }

    // Sort by search relevance if needed
    if (search && finalArticles.length > 1 && !salesSort) {
      const searchUpper = search.toUpperCase();
      const first = finalArticles[0];
      const rest = finalArticles.slice(1);
      
      rest.sort((a, b) => {
        const aCode = a.code.toUpperCase();
        const bCode = b.code.toUpperCase();

        const aStarts = aCode.startsWith(searchUpper);
        const bStarts = bCode.startsWith(searchUpper);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        const aOrder = a.displayOrder ?? 999999;
        const bOrder = b.displayOrder ?? 999999;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        return aCode.localeCompare(bCode);
      });

      finalArticles = [first, ...rest];
    }

    return NextResponse.json({
      data: finalArticles,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verificar permisos: solo admin puede crear artículos
    const user = getUserFromRequest(request);
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Solo los administradores pueden crear artículos' },
        { status: 403 }
      );
    }

    // Validate input
    const validatedData = createArticleSchema.parse(body);

    // Convert camelCase to snake_case for Prisma
    const article = await prisma.articles.create({
      data: {
        code: validatedData.code,
        description: validatedData.description,
        category_id: validatedData.categoryId,
        unit_price: validatedData.unitPrice,
        cost_price: validatedData.costPrice,
        stock: validatedData.stock ?? 0,
        minimum_stock: validatedData.minimumStock ?? 0,
        display_order: validatedData.displayOrder,
        is_discontinued: validatedData.isDiscontinued ?? false,
        is_active: validatedData.isActive ?? true,
        type: validatedData.type,
        series: validatedData.series,
        thickness: validatedData.thickness,
        size: validatedData.size,
        supplier_id: validatedData.supplierId,
        weight_kg: validatedData.weightKg,
        historical_price1: validatedData.historicalPrice1,
        location: validatedData.location,
        notes: validatedData.notes,
        created_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        categories: true,
      },
    });

    // Map to DTO format
    const mappedArticle = mapArticleToDTO(article);

    // Track creation
    const tracker = new ChangeTracker();
    tracker.trackCreate('article', article.id, article);

    // Log activity
    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.ARTICLE_CREATE,
      description: `Artículo ${article.description} (${article.code}) creado`,
      entityType: 'article',
      entityId: article.id,
      details: { code: article.code, description: article.description }
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

    return NextResponse.json(mappedArticle, { status: 201 });
  } catch (error) {
    console.error('Error creating article:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create article' },
      { status: 500 }
    );
  }
}

