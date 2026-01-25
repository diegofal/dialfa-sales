import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/utils/activityLogger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceListParams {
  categoryId?: string;
  search?: string;
  activeOnly?: boolean;
}

export interface BulkPriceUpdate {
  articleId: number;
  newPrice: number;
}

export interface BulkUpdateData {
  updates: BulkPriceUpdate[];
  changeType?: 'manual' | 'csv_import' | 'bulk_update';
  notes?: string;
}

export interface DraftData {
  draftData: Record<string, number>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function list(params: PriceListParams) {
  const { categoryId, search, activeOnly } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    deleted_at: null,
  };

  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (categoryId) {
    where.category_id = BigInt(categoryId);
  }

  if (activeOnly) {
    where.is_active = true;
  }

  const articles = await prisma.articles.findMany({
    where,
    include: {
      categories: {
        include: {
          category_payment_discounts: {
            include: { payment_terms: true },
            where: {
              payment_terms: { is_active: true },
            },
          },
        },
      },
    },
    orderBy: [{ categories: { name: 'asc' } }, { display_order: 'asc' }, { code: 'asc' }],
  });

  // Group articles by category
  const categoryMap = new Map<
    string,
    {
      categoryId: number;
      categoryName: string;
      categoryCode: string;
      paymentDiscounts: Array<{
        paymentTermId: number;
        paymentTermCode: string;
        paymentTermName: string;
        discountPercent: number;
      }>;
      items: Array<{
        id: number;
        code: string;
        description: string;
        unitPrice: number;
        stock: number;
        costPrice?: number;
        cifPercentage?: number;
        categoryId: number;
        categoryName: string;
        isActive: boolean;
        isDiscontinued: boolean;
        displayOrder?: string;
        type?: string;
        series?: number;
        thickness?: string;
        size?: string;
      }>;
    }
  >();

  articles.forEach((article) => {
    const categoryKey = article.category_id.toString();

    if (!categoryMap.has(categoryKey)) {
      const paymentDiscounts = article.categories.category_payment_discounts.map((cpd) => ({
        paymentTermId: cpd.payment_term_id,
        paymentTermCode: cpd.payment_terms.code,
        paymentTermName: cpd.payment_terms.name,
        discountPercent: Number(cpd.discount_percent),
      }));

      categoryMap.set(categoryKey, {
        categoryId: Number(article.category_id),
        categoryName: article.categories.name,
        categoryCode: article.categories.code,
        paymentDiscounts,
        items: [],
      });
    }

    const category = categoryMap.get(categoryKey)!;
    category.items.push({
      id: Number(article.id),
      code: article.code,
      description: article.description,
      unitPrice: Number(article.unit_price),
      stock: Number(article.stock),
      costPrice: article.last_purchase_price ? Number(article.last_purchase_price) : undefined,
      cifPercentage: article.cif_percentage ? Number(article.cif_percentage) : undefined,
      categoryId: Number(article.category_id),
      categoryName: article.categories.name,
      isActive: article.is_active,
      isDiscontinued: article.is_discontinued,
      displayOrder: article.display_order || undefined,
      type: article.type || undefined,
      series: article.series || undefined,
      thickness: article.thickness || undefined,
      size: article.size || undefined,
    });
  });

  const data = Array.from(categoryMap.values()).map((category) => ({
    ...category,
    totalItems: category.items.length,
  }));

  return {
    data,
    totalArticles: articles.length,
    totalCategories: data.length,
  };
}

export async function bulkUpdate(
  updateData: BulkUpdateData,
  userId?: number | null,
  userEmail?: string | null,
  request?: NextRequest
) {
  const changeBatchId = randomUUID();

  const updatedArticles = [];

  for (const update of updateData.updates) {
    const currentArticle = await prisma.articles.findUnique({
      where: { id: BigInt(update.articleId) },
      include: { categories: true },
    });

    if (!currentArticle || currentArticle.deleted_at) {
      continue;
    }

    const oldPrice = Number(currentArticle.unit_price);

    const updatedArticle = await prisma.articles.update({
      where: { id: BigInt(update.articleId) },
      data: {
        unit_price: update.newPrice,
        updated_at: new Date(),
        updated_by: userId,
      },
      include: { categories: true },
    });

    await prisma.price_history.create({
      data: {
        article_id: updatedArticle.id,
        old_price: oldPrice,
        new_price: update.newPrice,
        change_type: updateData.changeType || 'bulk_update',
        change_batch_id: changeBatchId,
        changed_by: userId,
        changed_by_name: userEmail,
        notes: updateData.notes,
      },
    });

    updatedArticles.push({
      id: Number(updatedArticle.id),
      code: updatedArticle.code,
      description: updatedArticle.description,
      unitPrice: Number(updatedArticle.unit_price),
      categoryName: updatedArticle.categories.name,
    });
  }

  if (request) {
    await logActivity({
      request,
      operation: OPERATIONS.PRICE_BULK_UPDATE,
      description: `Actualización masiva de ${updatedArticles.length} precios (Batch: ${changeBatchId.substring(0, 8)})`,
      details: {
        changeBatchId,
        updatedCount: updatedArticles.length,
        totalRequested: updateData.updates.length,
        changeType: updateData.changeType,
      },
    });
  }

  return {
    updatedCount: updatedArticles.length,
    changeBatchId,
    articles: updatedArticles,
  };
}

export async function revertSingle(
  priceHistoryId: number,
  userId?: number | null,
  userEmail?: string | null,
  request?: NextRequest
) {
  const historyRecord = await prisma.price_history.findUnique({
    where: { id: BigInt(priceHistoryId) },
    include: { articles: true },
  });

  if (!historyRecord) {
    return { error: 'Price history record not found', status: 404 };
  }

  if (!historyRecord.articles) {
    return { error: 'Article not found', status: 404 };
  }

  const article = historyRecord.articles;
  const currentPrice = Number(article.unit_price);
  const revertToPrice = Number(historyRecord.old_price);

  if (Math.abs(currentPrice - Number(historyRecord.new_price)) > 0.01) {
    return {
      error:
        'El precio actual no coincide con el historial. Es posible que ya haya sido revertido o modificado.',
      status: 400,
    };
  }

  await prisma.articles.update({
    where: { id: article.id },
    data: {
      unit_price: historyRecord.old_price,
      updated_at: new Date(),
      updated_by: userId,
    },
  });

  await prisma.price_history.create({
    data: {
      article_id: article.id,
      old_price: historyRecord.new_price,
      new_price: historyRecord.old_price,
      change_type: 'price_revert',
      change_batch_id: historyRecord.change_batch_id,
      changed_by: userId,
      changed_by_name: userEmail || 'Sistema',
      notes: `Reversión de cambio #${priceHistoryId} (${historyRecord.change_type})`,
    },
  });

  if (request) {
    await logActivity({
      request,
      operation: OPERATIONS.PRICE_REVERT,
      description: `Precio revertido para artículo ${article.code}: $${currentPrice.toFixed(2)} → $${revertToPrice.toFixed(2)}`,
      entityType: 'article',
      entityId: article.id,
      details: {
        articleCode: article.code,
        oldPrice: currentPrice,
        newPrice: revertToPrice,
        revertedFromHistoryId: priceHistoryId,
        changeBatchId: historyRecord.change_batch_id,
      },
    });
  }

  return {
    data: {
      id: Number(article.id),
      code: article.code,
      oldPrice: currentPrice,
      newPrice: revertToPrice,
    },
    status: 200,
  };
}

export async function revertBatch(
  changeBatchId: string,
  userId?: number | null,
  userEmail?: string | null,
  request?: NextRequest
) {
  const batchChanges = await prisma.price_history.findMany({
    where: { change_batch_id: changeBatchId },
    include: { articles: true },
    orderBy: { created_at: 'asc' },
  });

  if (batchChanges.length === 0) {
    return { error: 'No se encontraron cambios con ese batch ID', status: 404 };
  }

  const revertBatchId = randomUUID();
  const revertedArticles = [];
  const skippedArticles = [];

  for (const change of batchChanges) {
    const article = change.articles;
    const currentPrice = Number(article.unit_price);
    const revertToPrice = Number(change.old_price);

    if (Math.abs(currentPrice - Number(change.new_price)) > 0.01) {
      skippedArticles.push({
        code: article.code,
        reason: 'El precio fue modificado después de este cambio',
      });
      continue;
    }

    await prisma.articles.update({
      where: { id: article.id },
      data: {
        unit_price: change.old_price,
        updated_at: new Date(),
        updated_by: userId,
      },
    });

    await prisma.price_history.create({
      data: {
        article_id: article.id,
        old_price: change.new_price,
        new_price: change.old_price,
        change_type: 'manual',
        change_batch_id: revertBatchId,
        changed_by: userId,
        changed_by_name: userEmail || 'Sistema',
        notes: `Reversión del batch ${changeBatchId.substring(0, 8)}`,
      },
    });

    revertedArticles.push({
      code: article.code,
      oldPrice: currentPrice,
      newPrice: revertToPrice,
    });
  }

  if (request) {
    await logActivity({
      request,
      operation: OPERATIONS.PRICE_REVERT,
      description: `Revertidos ${revertedArticles.length} precios del batch ${changeBatchId.substring(0, 8)}`,
      entityType: 'price-list',
      details: {
        originalBatchId: changeBatchId,
        revertBatchId,
        revertedCount: revertedArticles.length,
        skippedCount: skippedArticles.length,
        totalInBatch: batchChanges.length,
      },
    });
  }

  return {
    data: {
      revertedCount: revertedArticles.length,
      skippedCount: skippedArticles.length,
      revertBatchId,
      originalBatchId: changeBatchId,
      skippedArticles: skippedArticles.length > 0 ? skippedArticles : undefined,
    },
    status: 200,
  };
}

export async function undo(
  userId?: number | null,
  userEmail?: string | null,
  request?: NextRequest
) {
  const lastBatch = await prisma.price_history.findFirst({
    where: { change_batch_id: { not: null } },
    orderBy: { created_at: 'desc' },
    select: { change_batch_id: true },
  });

  if (!lastBatch || !lastBatch.change_batch_id) {
    return { error: 'No hay cambios recientes para revertir', status: 404 };
  }

  const batchChanges = await prisma.price_history.findMany({
    where: { change_batch_id: lastBatch.change_batch_id },
    include: { articles: true },
    orderBy: { created_at: 'desc' },
  });

  if (batchChanges.length === 0) {
    return { error: 'No se encontraron cambios en el batch', status: 404 };
  }

  const revertBatchId = randomUUID();
  const revertedArticles = [];

  for (const change of batchChanges) {
    const article = change.articles;
    const currentPrice = Number(article.unit_price);
    const revertToPrice = Number(change.old_price);

    if (Math.abs(currentPrice - Number(change.new_price)) > 0.01) {
      continue;
    }

    await prisma.articles.update({
      where: { id: article.id },
      data: {
        unit_price: change.old_price,
        updated_at: new Date(),
        updated_by: userId,
      },
    });

    await prisma.price_history.create({
      data: {
        article_id: article.id,
        old_price: change.new_price,
        new_price: change.old_price,
        change_type: 'manual',
        change_batch_id: revertBatchId,
        changed_by: userId,
        changed_by_name: userEmail || 'Sistema',
        notes: `UNDO: Reversión del batch ${lastBatch.change_batch_id.substring(0, 8)}`,
      },
    });

    revertedArticles.push({
      code: article.code,
      oldPrice: currentPrice,
      newPrice: revertToPrice,
    });
  }

  if (request) {
    await logActivity({
      request,
      operation: OPERATIONS.PRICE_REVERT,
      description: `UNDO: Revertidos ${revertedArticles.length} precios del batch ${lastBatch.change_batch_id.substring(0, 8)}`,
      entityType: 'price-list',
      details: {
        originalBatchId: lastBatch.change_batch_id,
        revertBatchId,
        revertedCount: revertedArticles.length,
        totalInBatch: batchChanges.length,
      },
    });
  }

  return {
    data: {
      revertedCount: revertedArticles.length,
      revertBatchId,
      originalBatchId: lastBatch.change_batch_id,
    },
    status: 200,
  };
}

export async function getDraft(userId: number) {
  const draft = await prisma.price_import_drafts.findUnique({
    where: { user_id: userId },
  });

  if (!draft) {
    return null;
  }

  return {
    id: Number(draft.id),
    draftData: draft.draft_data,
    articleCount: draft.article_count,
    createdAt: draft.created_at.toISOString(),
    updatedAt: draft.updated_at.toISOString(),
  };
}

export async function saveDraft(userId: number, draftData: Record<string, number>) {
  const articleCount = Object.keys(draftData).length;

  const draft = await prisma.price_import_drafts.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      draft_data: draftData,
      article_count: articleCount,
    },
    update: {
      draft_data: draftData,
      article_count: articleCount,
      updated_at: new Date(),
    },
  });

  return {
    draftId: Number(draft.id),
    articleCount,
  };
}

export async function deleteDraft(userId: number) {
  try {
    await prisma.price_import_drafts.delete({
      where: { user_id: userId },
    });
  } catch {
    // If draft doesn't exist, it's not an error
  }
}

// ─── Price History ────────────────────────────────────────────────────────────

export interface PriceHistoryParams {
  page: number;
  limit: number;
  articleId?: string;
  categoryId?: string;
  changeType?: string;
  startDate?: string;
  endDate?: string;
}

export async function getHistory(params: PriceHistoryParams) {
  const { page, limit, articleId, categoryId, changeType, startDate, endDate } = params;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (articleId) {
    where.article_id = BigInt(articleId);
  }
  if (changeType) {
    where.change_type = changeType;
  }
  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at.gte = new Date(startDate);
    if (endDate) where.created_at.lte = new Date(endDate);
  }
  if (categoryId) {
    where.articles = { category_id: BigInt(categoryId), deleted_at: null };
  }

  const [history, total] = await Promise.all([
    prisma.price_history.findMany({
      where,
      include: {
        articles: { select: { id: true, code: true, description: true, category_id: true } },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.price_history.count({ where }),
  ]);

  return {
    data: history.map((h) => ({
      id: Number(h.id),
      articleId: Number(h.article_id),
      articleCode: h.articles.code,
      articleDescription: h.articles.description,
      oldPrice: Number(h.old_price),
      newPrice: Number(h.new_price),
      changeType: h.change_type,
      changeBatchId: h.change_batch_id || undefined,
      changedBy: h.changed_by || undefined,
      changedByName: h.changed_by_name || undefined,
      notes: h.notes || undefined,
      createdAt: h.created_at.toISOString(),
      priceChange: Number(h.new_price) - Number(h.old_price),
      priceChangePercent:
        Number(h.old_price) !== 0
          ? ((Number(h.new_price) - Number(h.old_price)) / Number(h.old_price)) * 100
          : 0,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
