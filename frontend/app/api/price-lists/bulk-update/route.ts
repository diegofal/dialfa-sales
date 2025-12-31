import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/roles';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

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
    if (!authorized) return error;

    const body = await request.json();
    
    // Validar datos de entrada
    const validatedData = bulkPriceUpdateSchema.parse(body);

    // Iniciar tracker de cambios
    const tracker = new ChangeTracker();
    
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

      // Guardar estado anterior para tracking
      const beforeState = {
        id: Number(currentArticle.id),
        code: currentArticle.code,
        description: currentArticle.description,
        unit_price: Number(currentArticle.unit_price),
      };

      // Actualizar el precio
      const updatedArticle = await prisma.articles.update({
        where: { id: BigInt(update.articleId) },
        data: {
          unit_price: update.newPrice,
          updated_at: new Date(),
        },
        include: { categories: true },
      });

      // Guardar en historial de precios
      try {
        await prisma.$executeRaw`
          INSERT INTO price_history (article_id, old_price, new_price, change_type, changed_by, changed_by_name, notes, created_at)
          VALUES (${updatedArticle.id}, ${currentArticle.unit_price}, ${update.newPrice}, ${validatedData.changeType || 'bulk_update'}, ${user.userId || null}, ${user.email || 'Sistema'}, ${validatedData.notes || null}, NOW())
        `;
      } catch (error) {
        console.error('Error saving price history:', error);
      }

      // Guardar estado posterior para tracking
      const afterState = {
        id: Number(updatedArticle.id),
        code: updatedArticle.code,
        description: updatedArticle.description,
        unit_price: Number(updatedArticle.unit_price),
      };

      // Track creation for activity log
      tracker.trackCreate('article', updatedArticle.id, afterState);

      updatedArticles.push({
        id: Number(updatedArticle.id),
        code: updatedArticle.code,
        description: updatedArticle.description,
        unitPrice: Number(updatedArticle.unit_price),
        categoryName: updatedArticle.categories.name,
      });
    }

    // Registrar actividad
    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.PRICE_BULK_UPDATE,
      description: `Actualización masiva de ${updatedArticles.length} precios`,
      entityType: 'price-list',
      entityId: BigInt(0),
      details: {
        updatedCount: updatedArticles.length,
        totalRequested: validatedData.updates.length,
      }
    });

    // Guardar cambios detallados
    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

    return NextResponse.json({
      success: true,
      updatedCount: updatedArticles.length,
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

