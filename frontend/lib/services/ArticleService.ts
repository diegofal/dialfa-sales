import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { STOCK_MOVEMENT_TYPES } from '@/lib/constants/stockMovementTypes';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/utils/activityLogger';
import {
  calculateABCClassification,
  refreshABCClassification,
  getABCCacheInfo,
} from '@/lib/utils/articles/abcClassification';
import { calculateSalesTrends, calculateLastSaleDates } from '@/lib/utils/articles/salesTrends';
import {
  calculateStockValuation,
  getStockValuationCacheInfo,
} from '@/lib/utils/articles/stockValuation';
import { ChangeTracker } from '@/lib/utils/changeTracker';
import { logger } from '@/lib/utils/logger';
import { mapArticleToDTO } from '@/lib/utils/mapper';
import { CreateArticleInput, UpdateArticleInput } from '@/lib/validations/schemas';
import { StockStatus } from '@/types/stockValuation';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type EnrichedArticleDTO = ReturnType<typeof mapArticleToDTO> & {
  abcClass?: string | null;
  salesTrend?: number[];
  salesTrendLabels?: string[];
  lastSaleDate?: string | null;
};

export interface ArticleListParams {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  isActive?: string;
  includeABC?: boolean;
  abcFilter?: string;
  salesSort?: string;
  trendMonths?: number;
  lowStockOnly?: boolean;
  hasStockOnly?: boolean;
  zeroStockOnly?: boolean;
  ids?: string;
  includeTrends?: boolean;
}

export interface ArticleListResult {
  data: EnrichedArticleDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StockMovementListParams {
  page: number;
  limit: number;
  articleId?: string;
  movementType?: string;
  startDate?: string;
  endDate?: string;
}

export interface StockAdjustmentData {
  articleId: number;
  quantity: number;
  reason: string;
  notes?: string;
}

export interface ValuationParams {
  activeThresholdDays: number;
  slowMovingThresholdDays: number;
  deadStockThresholdDays: number;
  minSalesForActive: number;
  trendMonths: number;
  includeZeroStock: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

function getMovementTypeName(type: number): string {
  const typeNames: Record<number, string> = {
    1: 'Compra',
    2: 'Venta',
    3: 'Devolución',
    4: 'Ajuste',
    5: 'Transferencia',
  };
  return typeNames[type] || 'Otro';
}

function enrichArticle(
  article: ArticleWithCategory,
  abcMap: Map<string, 'A' | 'B' | 'C'> | null,
  trendsData: { data: Map<string, number[]>; labels: string[] } | null,
  lastSaleDates: Map<string, Date | null> | null
): EnrichedArticleDTO {
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
}

export async function list(params: ArticleListParams): Promise<ArticleListResult> {
  const {
    page,
    limit,
    search,
    categoryId,
    isActive,
    includeABC,
    abcFilter,
    salesSort,
    trendMonths = 12,
    lowStockOnly,
    hasStockOnly,
    zeroStockOnly,
    ids,
    includeTrends,
  } = params;

  const skip = (page - 1) * limit;

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { deleted_at: null };

  if (ids) {
    const idArray = ids.split(',').map((id) => BigInt(id.trim()));
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

  if (isActive !== undefined && isActive !== null) {
    where.is_active = isActive === 'true';
  }

  if (hasStockOnly) {
    where.stock = { gt: 0 };
  } else if (zeroStockOnly) {
    where.stock = { equals: 0 };
  }

  // Get ABC classification and trends if requested
  let abcMap: Map<string, 'A' | 'B' | 'C'> | null = null;
  let trendsData: { data: Map<string, number[]>; labels: string[] } | null = null;
  let lastSaleDates: Map<string, Date | null> | null = null;

  try {
    lastSaleDates = await calculateLastSaleDates();
  } catch (error) {
    logger.error('Error getting LastSale dates', {}, error as Error);
  }

  if (includeABC || abcFilter || salesSort || includeTrends) {
    try {
      [abcMap, trendsData] = await Promise.all([
        calculateABCClassification(),
        calculateSalesTrends(trendMonths),
      ]);
    } catch (error) {
      logger.error('Error getting ABC/Trends classification', {}, error as Error);
    }
  }

  const needsFullDataset = !!(abcFilter || salesSort || lowStockOnly);

  let finalArticles: EnrichedArticleDTO[] = [];
  let totalCount = 0;

  if (needsFullDataset) {
    const allArticles = (await prisma.articles.findMany({
      where,
      include: { categories: true },
    })) as ArticleWithCategory[];

    let filtered = allArticles;

    if (abcFilter && abcMap) {
      filtered = filtered.filter((article) => abcMap.get(article.id.toString()) === abcFilter);
    }

    if (lowStockOnly) {
      filtered = filtered.filter((article) => {
        const stock = Number(article.stock);
        const minStock = Number(article.minimum_stock);
        return stock > 0 && stock < minStock;
      });
    }

    const mappedArticles = filtered.map((a) => enrichArticle(a, abcMap, trendsData, lastSaleDates));

    if (salesSort && trendsData) {
      mappedArticles.sort((a, b) => {
        const aSales = a.salesTrend?.reduce((sum, val) => sum + val, 0) || 0;
        const bSales = b.salesTrend?.reduce((sum, val) => sum + val, 0) || 0;
        return salesSort === 'most' ? bSales - aSales : aSales - bSales;
      });
    } else {
      mappedArticles.sort((a, b) => {
        const aOrder = a.displayOrder ?? 999999;
        const bOrder = b.displayOrder ?? 999999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.code.localeCompare(b.code);
      });
    }

    totalCount = mappedArticles.length;
    finalArticles = mappedArticles.slice(skip, skip + limit);
  } else {
    const shouldPaginate = !ids;

    const [articles, total] = await Promise.all([
      prisma.articles.findMany({
        where,
        include: { categories: true },
        orderBy: [{ display_order: 'asc' }, { code: 'asc' }],
        skip: shouldPaginate ? skip : undefined,
        take: shouldPaginate ? limit : undefined,
      }),
      prisma.articles.count({ where }),
    ]);

    finalArticles = (articles as ArticleWithCategory[]).map((a) =>
      enrichArticle(a, abcMap, trendsData, lastSaleDates)
    );
    totalCount = total;
  }

  // Handle exact match for search
  if (search && !needsFullDataset) {
    const exactMatch = await prisma.articles.findFirst({
      where: { ...where, code: { equals: search, mode: 'insensitive' } },
      include: { categories: true },
    });

    if (exactMatch) {
      const exactMatchDTO = enrichArticle(
        exactMatch as ArticleWithCategory,
        abcMap,
        trendsData,
        lastSaleDates
      );
      finalArticles = finalArticles.filter((a) => a.id !== exactMatchDTO.id);
      finalArticles.unshift(exactMatchDTO);
      if (finalArticles.length > limit) {
        finalArticles = finalArticles.slice(0, limit);
      }
    }
  }

  // Sort by search relevance
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
      if (aOrder !== bOrder) return aOrder - bOrder;
      return aCode.localeCompare(bCode);
    });

    finalArticles = [first, ...rest];
  }

  return {
    data: finalArticles,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}

export async function getById(id: bigint) {
  const article = await prisma.articles.findUnique({
    where: { id },
    include: { categories: true },
  });

  if (!article || article.deleted_at) {
    return null;
  }

  return mapArticleToDTO(article);
}

export async function create(data: CreateArticleInput, request: NextRequest) {
  const article = await prisma.articles.create({
    data: {
      code: data.code,
      description: data.description,
      category_id: data.categoryId,
      unit_price: data.unitPrice,
      cost_price: data.costPrice,
      stock: data.stock ?? 0,
      minimum_stock: data.minimumStock ?? 0,
      display_order: data.displayOrder,
      is_discontinued: data.isDiscontinued ?? false,
      is_active: data.isActive ?? true,
      type: data.type,
      series: data.series,
      thickness: data.thickness,
      size: data.size,
      supplier_id: data.supplierId,
      weight_kg: data.weightKg,
      last_purchase_price: data.lastPurchasePrice,
      cif_percentage: data.cifPercentage,
      historical_price1: data.historicalPrice1,
      location: data.location,
      notes: data.notes,
      created_at: new Date(),
      updated_at: new Date(),
    },
    include: { categories: true },
  });

  const tracker = new ChangeTracker();
  tracker.trackCreate('article', article.id, article);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.ARTICLE_CREATE,
    description: `Artículo ${article.description} (${article.code}) creado`,
    entityType: 'article',
    entityId: article.id,
    details: { code: article.code, description: article.description },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return mapArticleToDTO(article);
}

export async function update(id: bigint, data: UpdateArticleInput, request: NextRequest) {
  const existingArticle = await prisma.articles.findUnique({ where: { id } });

  if (!existingArticle || existingArticle.deleted_at) {
    return null;
  }

  const tracker = new ChangeTracker();
  await tracker.trackBefore('article', id);

  const article = await prisma.articles.update({
    where: { id },
    data: {
      code: data.code,
      description: data.description,
      category_id: data.categoryId,
      unit_price: data.unitPrice,
      cost_price: data.costPrice,
      stock: data.stock,
      minimum_stock: data.minimumStock,
      display_order: data.displayOrder,
      is_discontinued: data.isDiscontinued,
      is_active: data.isActive,
      type: data.type,
      series: data.series,
      thickness: data.thickness,
      size: data.size,
      supplier_id: data.supplierId,
      weight_kg: data.weightKg,
      last_purchase_price: data.lastPurchasePrice,
      cif_percentage: data.cifPercentage,
      historical_price1: data.historicalPrice1,
      location: data.location,
      notes: data.notes,
      updated_at: new Date(),
    },
    include: { categories: true },
  });

  await tracker.trackAfter('article', id);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.ARTICLE_UPDATE,
    description: `Artículo ${article.description} (${article.code}) actualizado`,
    entityType: 'article',
    entityId: id,
    details: { code: article.code, description: article.description },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return mapArticleToDTO(article);
}

export async function remove(id: bigint, request: NextRequest) {
  const existingArticle = await prisma.articles.findUnique({ where: { id } });

  if (!existingArticle || existingArticle.deleted_at) {
    return null;
  }

  const tracker = new ChangeTracker();
  tracker.trackDelete('article', id, existingArticle);

  await prisma.articles.update({
    where: { id },
    data: {
      deleted_at: new Date(),
      updated_at: new Date(),
    },
  });

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.ARTICLE_DELETE,
    description: `Artículo ${existingArticle.description} (${existingArticle.code}) eliminado`,
    entityType: 'article',
    entityId: id,
    details: { code: existingArticle.code, description: existingArticle.description },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return true;
}

export async function refreshABC() {
  const beforeInfo = getABCCacheInfo();
  await refreshABCClassification();
  const afterInfo = getABCCacheInfo();
  return { before: beforeInfo, after: afterInfo };
}

export function getABCInfo() {
  return getABCCacheInfo();
}

export async function getValuation(
  config: Partial<ValuationParams>,
  forceRefresh: boolean,
  statusFilter?: StockStatus
) {
  const cacheInfo = getStockValuationCacheInfo();
  const valuation = await calculateStockValuation(config, forceRefresh);

  if (statusFilter && valuation.byStatus[statusFilter]) {
    return {
      status: statusFilter,
      ...valuation.byStatus[statusFilter],
      config: valuation.config,
      calculatedAt: valuation.calculatedAt,
      cacheInfo,
    };
  }

  return { ...valuation, cacheInfo };
}

export async function listStockMovements(params: StockMovementListParams) {
  const { page, limit, articleId, movementType, startDate, endDate } = params;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { deleted_at: null };

  if (articleId) {
    where.article_id = BigInt(articleId);
  }

  if (movementType) {
    where.movement_type = parseInt(movementType);
  }

  if (startDate || endDate) {
    where.movement_date = {};
    if (startDate) where.movement_date.gte = new Date(startDate);
    if (endDate) where.movement_date.lte = new Date(endDate);
  }

  const [total, stockMovements] = await Promise.all([
    prisma.stock_movements.count({ where }),
    prisma.stock_movements.findMany({
      where,
      include: {
        articles: { select: { code: true, description: true } },
      },
      orderBy: { movement_date: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const movements = stockMovements.map((movement) => ({
    id: Number(movement.id),
    articleId: Number(movement.article_id),
    articleCode: movement.articles.code,
    articleDescription: movement.articles.description,
    movementType: movement.movement_type,
    movementTypeName: getMovementTypeName(movement.movement_type),
    quantity: movement.quantity,
    referenceDocument: movement.reference_document,
    movementDate: movement.movement_date.toISOString(),
    notes: movement.notes,
    createdAt: movement.created_at.toISOString(),
  }));

  return {
    data: movements,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function adjustStock(data: StockAdjustmentData, request: NextRequest) {
  const { articleId, quantity, reason, notes } = data;

  const article = await prisma.articles.findUnique({
    where: { id: BigInt(articleId) },
  });

  if (!article || article.deleted_at) {
    return null;
  }

  const tracker = new ChangeTracker();
  await tracker.trackBefore('article', BigInt(articleId));

  const now = new Date();
  const movementType = quantity >= 0 ? STOCK_MOVEMENT_TYPES.CREDIT : STOCK_MOVEMENT_TYPES.DEBIT;

  const result = await prisma.$transaction(async (tx) => {
    const movement = await tx.stock_movements.create({
      data: {
        article_id: BigInt(articleId),
        movement_type: movementType,
        quantity: Math.abs(quantity),
        reference_document: `Ajuste manual: ${reason}`,
        movement_date: now,
        notes: notes || `Ajuste manual de stock por ${reason}`,
        created_at: now,
        updated_at: now,
      },
    });

    const updatedArticle = await tx.articles.update({
      where: { id: BigInt(articleId) },
      data: {
        stock: { increment: quantity },
        updated_at: now,
      },
    });

    return { movement, updatedArticle };
  });

  await tracker.trackAfter('article', BigInt(articleId));

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.ARTICLE_STOCK_ADJUST,
    description: `Ajuste de stock para ${article.description}: ${quantity > 0 ? '+' : ''}${quantity} unidades (${reason})`,
    entityType: 'article',
    entityId: article.id,
    details: {
      articleCode: article.code,
      quantity,
      reason,
      oldStock: Number(article.stock),
      newStock: Number(result.updatedArticle.stock),
    },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return { newStock: Number(result.updatedArticle.stock) };
}
