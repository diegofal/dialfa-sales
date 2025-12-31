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
    
    // Obtener el CIF percentage del body (opcional)
    const body = await request.json().catch(() => ({}));
    const cifPercentage = body.cifPercentage ? Number(body.cifPercentage) : null;

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

    // Filtrar items que tienen datos para sincronizar (peso o precio)
    const itemsToSync = order.supplier_order_items.filter(
      item => 
        (item.unit_weight !== null && Number(item.unit_weight) > 0) ||
        (item.proforma_unit_price !== null && Number(item.proforma_unit_price) > 0)
    );

    if (itemsToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay datos para sincronizar',
        updatedCount: 0,
      });
    }

    // Actualizar el peso y precio de compra en cada artículo
    let updatedCount = 0;
    const updates: { 
      articleId: bigint; 
      articleCode: string; 
      newWeight?: number;
      newPurchasePrice?: number;
      newCifPercentage?: number;
    }[] = [];

    for (const item of itemsToSync) {
      const updateData: {
        weight_kg?: number;
        last_purchase_price?: number;
        cif_percentage?: number;
        updated_at: Date;
        updated_by: number;
      } = {
        updated_at: new Date(),
        updated_by: user.userId,
      };

      const updateInfo: {
        articleId: bigint;
        articleCode: string;
        newWeight?: number;
        newPurchasePrice?: number;
        newCifPercentage?: number;
      } = {
        articleId: item.article_id,
        articleCode: item.article_code,
      };

      // Sincronizar peso si existe
      if (item.unit_weight !== null && Number(item.unit_weight) > 0) {
        const newWeight = Number(item.unit_weight);
        updateData.weight_kg = newWeight;
        updateInfo.newWeight = newWeight;
      }

      // Sincronizar precio de compra si existe
      if (item.proforma_unit_price !== null && Number(item.proforma_unit_price) > 0) {
        const newPurchasePrice = Number(item.proforma_unit_price);
        updateData.last_purchase_price = newPurchasePrice;
        updateInfo.newPurchasePrice = newPurchasePrice;
      }

      // Sincronizar CIF percentage si fue proporcionado
      if (cifPercentage !== null && cifPercentage > 0) {
        updateData.cif_percentage = cifPercentage;
        updateInfo.newCifPercentage = cifPercentage;
      }

      // Solo actualizar si hay algo que sincronizar
      if (updateData.weight_kg !== undefined || updateData.last_purchase_price !== undefined || updateData.cif_percentage !== undefined) {
        await prisma.articles.update({
          where: { id: item.article_id },
          data: updateData,
        });

        updates.push(updateInfo);
        updatedCount++;
      }
    }

    // Log de actividad
    await logActivity({
      request,
      operation: OPERATIONS.ARTICLE_UPDATE,
      description: `Datos sincronizados desde pedido ${order.order_number}: ${updatedCount} artículos actualizados`,
      entityType: 'supplier_order',
      entityId: orderId,
      details: { 
        orderNumber: order.order_number,
        cifPercentage: cifPercentage,
        updatedArticles: updates.map(u => ({
          code: u.articleCode,
          ...(u.newWeight !== undefined && { weight: u.newWeight }),
          ...(u.newPurchasePrice !== undefined && { purchasePrice: u.newPurchasePrice }),
          ...(u.newCifPercentage !== undefined && { cifPercentage: u.newCifPercentage }),
        })),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Se actualizaron ${updatedCount} artículos con sus datos de proforma`,
      updatedCount,
      updates: updates.map(u => ({
        articleCode: u.articleCode,
        ...(u.newWeight !== undefined && { newWeight: u.newWeight }),
        ...(u.newPurchasePrice !== undefined && { newPurchasePrice: u.newPurchasePrice }),
        ...(u.newCifPercentage !== undefined && { newCifPercentage: u.newCifPercentage }),
      })),
    });
  } catch (error) {
    console.error('Error syncing data:', error);
    return NextResponse.json(
      { error: 'Error al sincronizar datos' },
      { status: 500 }
    );
  }
}

