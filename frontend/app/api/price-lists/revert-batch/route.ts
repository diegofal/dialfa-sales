import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/roles';
import { logActivity } from '@/lib/services/activityLogger';
import { OPERATIONS } from '@/lib/constants/operations';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Verificar permisos de administrador
    const { authorized, error, user } = requireAdmin(request);
    if (!authorized) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { changeBatchId } = body;

    if (!changeBatchId) {
      return NextResponse.json(
        { error: 'changeBatchId is required' },
        { status: 400 }
      );
    }

    // Obtener todos los cambios de ese batch
    const batchChanges = await prisma.price_history.findMany({
      where: { change_batch_id: changeBatchId },
      include: { articles: true },
      orderBy: { created_at: 'asc' },
    });

    if (batchChanges.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron cambios con ese batch ID' },
        { status: 404 }
      );
    }

    // Generar nuevo batch ID para la reversión
    const revertBatchId = randomUUID();
    const revertedArticles = [];
    const skippedArticles = [];

    // Revertir cada cambio
    for (const change of batchChanges) {
      const article = change.articles;
      const currentPrice = Number(article.unit_price);
      const revertToPrice = Number(change.old_price);

      // Verificar que el precio actual es el que se cambió
      if (Math.abs(currentPrice - Number(change.new_price)) > 0.01) {
        skippedArticles.push({
          code: article.code,
          reason: 'El precio fue modificado después de este cambio',
        });
        continue;
      }

      // Actualizar precio
      await prisma.articles.update({
        where: { id: article.id },
        data: { 
          unit_price: change.old_price,
          updated_at: new Date(),
          updated_by: user?.id,
        },
      });

      // Crear registro de historial para la reversión
      await prisma.price_history.create({
        data: {
          article_id: article.id,
          old_price: change.new_price,
          new_price: change.old_price,
          change_type: 'manual',
          change_batch_id: revertBatchId,
          changed_by: user?.id,
          changed_by_name: user?.name || user?.email,
          notes: `Reversión del batch ${changeBatchId.substring(0, 8)}`,
        },
      });

      revertedArticles.push({
        code: article.code,
        oldPrice: currentPrice,
        newPrice: revertToPrice,
      });
    }

    // Log de actividad
    await logActivity({
      operation: OPERATIONS.PRICE_REVERT,
      userId: user?.id,
      userName: user?.name || user?.email,
      description: `Revertidos ${revertedArticles.length} precios del batch ${changeBatchId.substring(0, 8)}`,
      metadata: {
        originalBatchId: changeBatchId,
        revertBatchId,
        revertedCount: revertedArticles.length,
        skippedCount: skippedArticles.length,
        totalInBatch: batchChanges.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Se revirtieron ${revertedArticles.length} de ${batchChanges.length} precios`,
      revertedCount: revertedArticles.length,
      skippedCount: skippedArticles.length,
      revertBatchId,
      originalBatchId: changeBatchId,
      skippedArticles: skippedArticles.length > 0 ? skippedArticles : undefined,
    });
  } catch (error) {
    console.error('Error reverting batch:', error);
    return NextResponse.json(
      { error: 'Failed to revert batch' },
      { status: 500 }
    );
  }
}
