import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/roles';
import { logActivity } from '@/lib/services/activityLogger';
import { OPERATIONS } from '@/lib/constants/operations';

export async function POST(request: NextRequest) {
  try {
    // Verificar permisos de administrador
    const { authorized, error, user } = requireAdmin(request);
    if (!authorized) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { priceHistoryId } = body;

    if (!priceHistoryId) {
      return NextResponse.json(
        { error: 'priceHistoryId is required' },
        { status: 400 }
      );
    }

    // Obtener el registro de historial
    const historyRecord = await prisma.price_history.findUnique({
      where: { id: BigInt(priceHistoryId) },
      include: {
        articles: true,
      },
    });

    if (!historyRecord) {
      return NextResponse.json(
        { error: 'Price history record not found' },
        { status: 404 }
      );
    }

    // Verificar que el artículo existe
    if (!historyRecord.articles) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    const article = historyRecord.articles;
    const currentPrice = Number(article.unit_price);
    const revertToPrice = Number(historyRecord.old_price);

    // Verificar que el precio actual es el que se cambió en ese historial
    if (Math.abs(currentPrice - Number(historyRecord.new_price)) > 0.01) {
      return NextResponse.json(
        { error: 'El precio actual no coincide con el historial. Es posible que ya haya sido revertido o modificado.' },
        { status: 400 }
      );
    }

    // Actualizar el precio del artículo
    await prisma.articles.update({
      where: { id: article.id },
      data: { 
        unit_price: historyRecord.old_price,
        updated_at: new Date(),
        updated_by: user?.userId,
      },
    });

    // Crear nuevo registro en el historial indicando la reversión
    // Usar el mismo changeBatchId del registro original para mantener la trazabilidad
    await prisma.price_history.create({
      data: {
        article_id: article.id,
        old_price: historyRecord.new_price,
        new_price: historyRecord.old_price,
        change_type: 'price_revert',
        change_batch_id: historyRecord.change_batch_id, // Mantener el batch ID original
        changed_by: user?.userId,
        changed_by_name: user?.email || 'Sistema',
        notes: `Reversión de cambio #${priceHistoryId} (${historyRecord.change_type})`,
      },
    });

    // Log de actividad
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

    return NextResponse.json({
      success: true,
      message: 'Precio revertido exitosamente',
      article: {
        id: Number(article.id),
        code: article.code,
        oldPrice: currentPrice,
        newPrice: revertToPrice,
      },
    });
  } catch (error) {
    console.error('Error reverting price:', error);
    return NextResponse.json(
      { error: 'Failed to revert price' },
      { status: 500 }
    );
  }
}
