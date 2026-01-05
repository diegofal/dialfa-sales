import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/roles';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { randomUUID } from 'crypto';

// Schema de validación para actualizaciones masivas
const bulkPriceUpdateSchema = z.object({
  updates: z.array(z.object({
    articleId: z.number(),
    newPrice: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  })).min(1, 'Debe haber al menos una actualización'),
  changeType: z.enum(['manual', 'csv_import', 'bulk_update']).optional().default('bulk_update'),
  notes: z.string().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    // Verificar permisos de administrador
    const { authorized, error, user } = requireAdmin(request);
    if (!authorized) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validar datos de entrada
    const validatedData = bulkPriceUpdateSchema.parse(body);

    console.log(`[BULK-UPDATE] Received request with ${validatedData.updates.length} updates`);

    // Generar UUID único para este lote de cambios
    const changeBatchId = randomUUID();
    
    console.log(`[BULK-UPDATE] Generated batch ID: ${changeBatchId.substring(0, 8)}`);
    
    // Actualizar cada artículo
    const updatedArticles = [];
    
    for (const update of validatedData.updates) {
      // Obtener artículo actual para el log
      const currentArticle = await prisma.articles.findUnique({
        where: { id: BigInt(update.articleId) },
        include: { categories: true },
      });

      if (!currentArticle || currentArticle.deleted_at) {
        continue; // Skip deleted or non-existent articles
      }

      const oldPrice = Number(currentArticle.unit_price);

      // Actualizar el precio
      const updatedArticle = await prisma.articles.update({
        where: { id: BigInt(update.articleId) },
        data: {
          unit_price: update.newPrice,
          updated_at: new Date(),
          updated_by: user?.userId,
        },
        include: { categories: true },
      });

      // Guardar en historial de precios con batch ID
      await prisma.price_history.create({
        data: {
          article_id: updatedArticle.id,
          old_price: oldPrice,
          new_price: update.newPrice,
          change_type: validatedData.changeType || 'bulk_update',
          change_batch_id: changeBatchId,
          changed_by: user?.userId,
          changed_by_name: user?.email,
          notes: validatedData.notes,
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

    // Registrar actividad
    await logActivity({
      request,
      operation: OPERATIONS.PRICE_BULK_UPDATE,
      description: `Actualización masiva de ${updatedArticles.length} precios (Batch: ${changeBatchId.substring(0, 8)})`,
      details: {
        changeBatchId,
        updatedCount: updatedArticles.length,
        totalRequested: validatedData.updates.length,
        changeType: validatedData.changeType,
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: updatedArticles.length,
      changeBatchId,
      articles: updatedArticles,
    });
  } catch (error) {
    console.error('Error updating prices:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update prices' },
      { status: 500 }
    );
  }
}
