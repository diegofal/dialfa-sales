'use server';

import { getErrorMessage } from '@/lib/utils/errors';

import { prisma } from '@/lib/db';
import { createSalesOrderSchema, updateSalesOrderSchema, type CreateSalesOrderInput, type UpdateSalesOrderInput } from '@/lib/validations/schemas';
import { revalidatePath } from 'next/cache';

// Generate order number (format: SO-YYYYMMDD-XXXX)
async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const lastOrder = await prisma.sales_orders.findFirst({
    where: {
      order_number: {
        startsWith: `SO-${dateStr}`,
      },
    },
    orderBy: {
      order_number: 'desc',
    },
  });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.order_number.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `SO-${dateStr}-${sequence.toString().padStart(4, '0')}`;
}

export async function createSalesOrder(data: CreateSalesOrderInput) {
  try {
    const validated = createSalesOrderSchema.parse(data);

    // Verify client exists
    const client = await prisma.clients.findUnique({
      where: { id: validated.clientId },
      include: {
        client_discounts: true,
      },
    });

    if (!client || client.deleted_at) {
      return {
        success: false,
        error: 'Cliente no encontrado',
      };
    }

    // Verify all articles exist and get prices
    const articleIds = validated.items.map(item => item.articleId);
    const articles = await prisma.articles.findMany({
      where: {
        id: { in: articleIds },
        deleted_at: null,
        is_active: true,
      },
      include: {
        categories: true,
      },
    });

    if (articles.length !== articleIds.length) {
      return {
        success: false,
        error: 'Uno o más artículos no encontrados o inactivos',
      };
    }

    // Generate order number
    const orderNumber = await generateOrderNumber();

    // Calculate totals
    let total = 0;
    const items = validated.items.map(item => {
      const unitPrice = item.unitPrice;
      const lineTotal = unitPrice * item.quantity * (1 - item.discountPercent / 100);
      total += lineTotal;

      return {
        article_id: item.articleId,
        quantity: item.quantity,
        unit_price: unitPrice,
        discount_percent: item.discountPercent,
        line_total: lineTotal,
        created_at: new Date(),
      };
    });

    // Apply special discount
    if (validated.specialDiscountPercent > 0) {
      total = total * (1 - validated.specialDiscountPercent / 100);
    }

    // Create sales order with items
    const salesOrder = await prisma.sales_orders.create({
      data: {
        client_id: validated.clientId,
        order_number: orderNumber,
        order_date: validated.orderDate,
        delivery_date: validated.deliveryDate,
        status: validated.status || 'PENDING',
        special_discount_percent: validated.specialDiscountPercent,
        total,
        notes: validated.notes,
        created_at: new Date(),
        updated_at: new Date(),
        sales_order_items: {
          create: items,
        },
      },
      include: {
        sales_order_items: {
          include: {
            articles: {
              include: {
                categories: true,
              },
            },
          },
        },
        clients: true,
      },
    });

    revalidatePath('/dashboard/sales-orders');

    return {
      success: true,
      data: {
        ...salesOrder,
        id: salesOrder.id.toString(),
        client_id: salesOrder.client_id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error creating sales order:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to create sales order',
    };
  }
}

export async function updateSalesOrder(id: string, data: UpdateSalesOrderInput) {
  try {
    const salesOrderId = BigInt(id);
    const validated = updateSalesOrderSchema.parse(data);

    const existing = await prisma.sales_orders.findUnique({
      where: { id: salesOrderId },
      include: {
        invoices: true,
      },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Pedido no encontrado',
      };
    }

    // Don't allow editing if already invoiced
    if (existing.invoices.length > 0) {
      return {
        success: false,
        error: 'No se puede editar un pedido que ya tiene facturas',
      };
    }

    // If items are being updated, recalculate
    const updateData: {
      order_date?: Date;
      delivery_date?: Date | null;
      status?: string;
      special_discount_percent?: number;
      notes?: string | null;
      updated_at: Date;
      total?: number;
      sales_order_items?: {
        create: Array<{
          article_id: bigint;
          quantity: number;
          unit_price: number;
          discount_percent: number;
          line_total: number;
          created_at: Date;
        }>;
      };
    } = {
      order_date: validated.orderDate,
      delivery_date: validated.deliveryDate,
      status: validated.status,
      special_discount_percent: validated.specialDiscountPercent,
      notes: validated.notes,
      updated_at: new Date(),
    };

    if (validated.items && validated.items.length > 0) {
      // Delete existing items
      await prisma.sales_order_items.deleteMany({
        where: { sales_order_id: salesOrderId },
      });

      // Calculate new totals
      let total = 0;
      const items = validated.items.map(item => {
        const lineTotal = item.unitPrice * item.quantity * (1 - item.discountPercent / 100);
        total += lineTotal;

        return {
          article_id: item.articleId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_percent: item.discountPercent,
          line_total: lineTotal,
          created_at: new Date(),
        };
      });

      if (validated.specialDiscountPercent && validated.specialDiscountPercent > 0) {
        total = total * (1 - validated.specialDiscountPercent / 100);
      }

      updateData.total = total;
      updateData.sales_order_items = {
        create: items,
      };
    }

    const salesOrder = await prisma.sales_orders.update({
      where: { id: salesOrderId },
      data: updateData,
      include: {
        sales_order_items: {
          include: {
            articles: {
              include: {
                categories: true,
              },
            },
          },
        },
        clients: true,
      },
    });

    revalidatePath('/dashboard/sales-orders');
    revalidatePath(`/dashboard/sales-orders/${id}`);

    return {
      success: true,
      data: {
        ...salesOrder,
        id: salesOrder.id.toString(),
        client_id: salesOrder.client_id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error updating sales order:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to update sales order',
    };
  }
}

export async function cancelSalesOrder(id: string) {
  try {
    const salesOrderId = BigInt(id);

    const existing = await prisma.sales_orders.findUnique({
      where: { id: salesOrderId },
      include: {
        invoices: {
          where: { is_cancelled: false },
        },
      },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Pedido no encontrado',
      };
    }

    if (existing.invoices.length > 0) {
      return {
        success: false,
        error: 'No se puede cancelar un pedido con facturas activas',
      };
    }

    const salesOrder = await prisma.sales_orders.update({
      where: { id: salesOrderId },
      data: {
        status: 'CANCELLED',
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/sales-orders');
    revalidatePath(`/dashboard/sales-orders/${id}`);

    return {
      success: true,
      message: 'Pedido cancelado correctamente',
      data: {
        ...salesOrder,
        id: salesOrder.id.toString(),
        client_id: salesOrder.client_id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error cancelling sales order:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to cancel sales order',
    };
  }
}

export async function deleteSalesOrder(id: string) {
  try {
    const salesOrderId = BigInt(id);

    const existing = await prisma.sales_orders.findUnique({
      where: { id: salesOrderId },
      include: {
        invoices: true,
      },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Pedido no encontrado',
      };
    }

    if (existing.invoices.length > 0) {
      return {
        success: false,
        error: 'No se puede eliminar un pedido con facturas',
      };
    }

    await prisma.sales_orders.update({
      where: { id: salesOrderId },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/sales-orders');

    return {
      success: true,
      message: 'Pedido eliminado correctamente',
    };
  } catch (error: unknown) {
    console.error('Error deleting sales order:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to delete sales order',
    };
  }
}

