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

    // Obtener el último batch de cambios
    const lastBatch = await prisma.price_history.findFirst({
      where: {
        change_batch_id: { not: null },
      },
      orderBy: { created_at: 'desc' },
      select: { change_batch_id: true },
    });

    if (!lastBatch || !lastBatch.change_batch_id) {
      return NextResponse.json(
        { error: 'No hay cambios recientes para revertir' },
        { status: 404 }
      );
    }

    // Obtener todos los cambios de ese batch
    const batchChanges = await prisma.price_history.findMany({
      where: { change_batch_id: lastBatch.change_batch_id },
      include: { articles: true },
      orderBy: { created_at: 'desc' },
    });

    if (batchChanges.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron cambios en el batch' },
        { status: 404 }
      );
    }

    // Generar nuevo batch ID para la reversión
    const revertBatchId = randomUUID();
    const revertedArticles = [];

    // Revertir cada cambio
    for (const change of batchChanges) {
      const article = change.articles;
      const currentPrice = Number(article.unit_price);
      const revertToPrice = Number(change.old_price);

      // Verificar que el precio actual es el que se cambió
      if (Math.abs(currentPrice - Number(change.new_price)) > 0.01) {
        console.warn(`Artículo ${article.code} ya fue modificado después del batch`);
        continue;
      }

      // Actualizar precio
      await prisma.articles.update({
        where: { id: article.id },
        data: { 
          unit_price: change.old_price,
          updated_at: new Date(),
          updated_by: user?.userId,
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
          changed_by: user?.userId,
          changed_by_name: user?.email || 'Sistema',
          notes: `UNDO: Reversión del batch ${lastBatch.change_batch_id.substring(0, 8)}`,
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

    return NextResponse.json({
      success: true,
      message: `Se revirtieron ${revertedArticles.length} precios`,
      revertedCount: revertedArticles.length,
      revertBatchId,
      originalBatchId: lastBatch.change_batch_id,
    });
  } catch (error) {
    console.error('Error in undo:', error);
    return NextResponse.json(
      { error: 'Failed to undo price changes' },
      { status: 500 }
    );
  }
}
