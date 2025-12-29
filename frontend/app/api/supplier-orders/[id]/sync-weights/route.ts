import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth/roles';
import { logActivity } from '@/lib/services/activityLogger';
import { OPERATIONS } from '@/lib/constants/operations';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const orderId = BigInt(idParam);

    // Obtener la orden con sus items
    const order = await prisma.supplier_orders.findUnique({
      where: { id: orderId },
      include: {
        supplier_order_items: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Pedido no encontrado' },
        { status: 404 }
      );
    }

    // Filtrar items que tienen peso unitario definido
    const itemsWithWeight = order.supplier_order_items.filter(
      item => item.unit_weight !== null && Number(item.unit_weight) > 0
    );

    if (itemsWithWeight.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay pesos unitarios para sincronizar',
        updatedCount: 0,
      });
    }

    // Actualizar el peso en cada artículo
    let updatedCount = 0;
    const updates: { articleId: bigint; articleCode: string; newWeight: number }[] = [];

    for (const item of itemsWithWeight) {
      const newWeight = Number(item.unit_weight);
      
      await prisma.articles.update({
        where: { id: item.article_id },
        data: {
          weight_kg: newWeight,
          updated_at: new Date(),
          updated_by: user.userId,
        },
      });

      updates.push({
        articleId: item.article_id,
        articleCode: item.article_code,
        newWeight,
      });
      updatedCount++;
    }

    // Log de actividad
    await logActivity({
      request,
      operation: OPERATIONS.ARTICLE_UPDATE,
      description: `Pesos unitarios sincronizados desde pedido ${order.order_number}: ${updatedCount} artículos actualizados`,
      entityType: 'supplier_order',
      entityId: orderId,
      details: { 
        orderNumber: order.order_number,
        updatedArticles: updates.map(u => ({
          code: u.articleCode,
          weight: u.newWeight,
        })),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Se actualizaron ${updatedCount} artículos con sus pesos unitarios`,
      updatedCount,
      updates: updates.map(u => ({
        articleCode: u.articleCode,
        newWeight: u.newWeight,
      })),
    });
  } catch (error) {
    console.error('Error syncing weights:', error);
    return NextResponse.json(
      { error: 'Error al sincronizar pesos' },
      { status: 500 }
    );
  }
}


