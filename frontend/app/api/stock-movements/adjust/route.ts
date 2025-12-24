import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { STOCK_MOVEMENT_TYPES } from '@/lib/constants/stockMovementTypes';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';
import { z } from 'zod';

const adjustStockSchema = z.object({
  articleId: z.number(),
  quantity: z.number(),
  reason: z.string(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = adjustStockSchema.parse(body);
    const { articleId, quantity, reason, notes } = validatedData;

    const article = await prisma.articles.findUnique({
      where: { id: BigInt(articleId) },
    });

    if (!article || article.deleted_at) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const tracker = new ChangeTracker();
    await tracker.trackBefore('article', BigInt(articleId));

    const now = new Date();
    const movementType = quantity >= 0 ? STOCK_MOVEMENT_TYPES.CREDIT : STOCK_MOVEMENT_TYPES.DEBIT;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create stock movement
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

      // 2. Update article stock
      const updatedArticle = await tx.articles.update({
        where: { id: BigInt(articleId) },
        data: {
          stock: {
            increment: quantity,
          },
          updated_at: now,
        },
      });

      return { movement, updatedArticle };
    });

    await tracker.trackAfter('article', BigInt(articleId));

    // 3. Log activity
    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.STOCK_ADJUST,
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

    return NextResponse.json({
      message: 'Stock adjusted successfully',
      newStock: Number(result.updatedArticle.stock),
    });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

