import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapSalesOrderToDTO } from '@/lib/utils/mapper';
import { updateSalesOrderSchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { STOCK_MOVEMENT_TYPES } from '@/lib/constants/stockMovementTypes';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    const salesOrder = await prisma.sales_orders.findUnique({
      where: { id },
      include: {
        clients: true,
        sales_order_items: {
          include: {
            articles: true,
          },
          orderBy: {
            id: 'asc',
          },
        },
        invoices: {
          select: {
            id: true,
            invoice_number: true,
            is_printed: true,
            is_cancelled: true,
          },
          where: {
            deleted_at: null,
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 1,
        },
        delivery_notes: {
          select: {
            id: true,
            delivery_number: true,
            delivery_date: true,
          },
          where: {
            deleted_at: null,
          },
          orderBy: {
            created_at: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!salesOrder || salesOrder.deleted_at) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Map to DTO format (snake_case to camelCase)
    const mappedSalesOrder = mapSalesOrderToDTO(salesOrder);

    return NextResponse.json(mappedSalesOrder);
  } catch (error) {
    console.error('Error fetching sales order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales order' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);
    const body = await request.json();

    // Check if sales order exists and is not deleted
    const existingSalesOrder = await prisma.sales_orders.findUnique({
      where: { id },
      include: {
        invoices: {
          select: {
            id: true,
            is_printed: true,
            is_cancelled: true,
          },
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    if (!existingSalesOrder || existingSalesOrder.deleted_at) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    // Check permissions: cannot edit if invoice is printed AND not cancelled
    // Cancelled invoices don't block editing because they have no fiscal impact
    const activeInvoice = existingSalesOrder.invoices[0];
    if (activeInvoice && activeInvoice.is_printed && !activeInvoice.is_cancelled) {
      return NextResponse.json(
        { error: 'No se puede modificar un pedido con factura impresa activa' },
        { status: 403 }
      );
    }

    // Validate input
    const validatedData = updateSalesOrderSchema.parse(body);

    const now = new Date();

    // Check for unprinted invoices and delivery notes that need updating
    const unprintedInvoices = await prisma.invoices.findMany({
      where: {
        sales_order_id: id,
        is_printed: false,
        is_cancelled: false,
        deleted_at: null,
      },
    });

    const unprintedDeliveryNotes = await prisma.delivery_notes.findMany({
      where: {
        sales_order_id: id,
        is_printed: false,
        deleted_at: null,
      },
    });

    // If items are included, update them in transaction
    if (validatedData.items && validatedData.items.length > 0) {
      // Calculate totals for each item and overall total
      const itemsData = validatedData.items.map((item) => {
        const lineTotal = item.quantity * item.unitPrice * (1 - item.discountPercent / 100);
        return {
          article_id: item.articleId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_percent: item.discountPercent,
          line_total: lineTotal,
        };
      });

      const subtotal = itemsData.reduce((sum, item) => sum + item.line_total, 0);
      const total = subtotal * (1 - (validatedData.specialDiscountPercent ?? 0) / 100);

      // Update in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Delete existing sales order items
        await tx.sales_order_items.deleteMany({
          where: { sales_order_id: id },
        });

        // Update sales order
        const salesOrder = await tx.sales_orders.update({
          where: { id },
          data: {
            client_id: validatedData.clientId,
            status: validatedData.status,
            special_discount_percent: validatedData.specialDiscountPercent,
            total: total,
            notes: validatedData.notes,
            updated_at: now,
          },
        });

        // Create new items
        const itemsWithOrderId = itemsData.map((item) => ({
          ...item,
          sales_order_id: salesOrder.id,
          created_at: now,
        }));

        await tx.sales_order_items.createMany({
          data: itemsWithOrderId,
        });

        // Get created items with article info for updating documents
        const createdItems = await tx.sales_order_items.findMany({
          where: { sales_order_id: id },
          include: { 
            articles: {
              include: {
                categories: true  // Include categories for discount info
              }
            }
          },
        });

        // Update invoices if any exist (instead of regenerating)
        for (const invoice of unprintedInvoices) {
          // Get existing invoice items to preserve discount percentages
          const existingInvoiceItems = await tx.invoice_items.findMany({
            where: { invoice_id: invoice.id },
          });

          // Create a map of article_id to discount_percent from existing invoice
          const existingDiscounts = new Map(
            existingInvoiceItems.map(item => [
              item.article_id.toString(),
              parseFloat(item.discount_percent.toString())
            ])
          );

          // Delete old invoice items
          await tx.invoice_items.deleteMany({
            where: { invoice_id: invoice.id },
          });

          // Use preserved exchange rate
          const usdExchangeRate = invoice.usd_exchange_rate ? parseFloat(invoice.usd_exchange_rate.toString()) : 1000;

          // Calculate new amounts
          const TAX_RATE = 0.21;
          let netAmountArs = 0;
          
          const newInvoiceItems = createdItems.map((item) => {
            const unitPriceUsd = parseFloat(item.unit_price.toString());
            const unitPriceArs = unitPriceUsd * usdExchangeRate;
            
            // PRESERVE existing discount or use category default for new items
            const articleIdStr = item.article_id.toString();
            const discountPercent = existingDiscounts.has(articleIdStr)
              ? existingDiscounts.get(articleIdStr)!
              : (item.articles.categories?.default_discount_percent 
                  ? parseFloat(item.articles.categories.default_discount_percent.toString())
                  : 0);
            
            const quantity = item.quantity;
            
            const subtotal = unitPriceArs * quantity;
            const discount = subtotal * (discountPercent / 100);
            const lineTotal = subtotal - discount;
            
            netAmountArs += lineTotal;
            
            return {
              invoice_id: invoice.id,
              article_id: item.article_id,
              article_code: item.articles.code,
              article_description: item.articles.description,
              quantity: quantity,
              unit_price_usd: unitPriceUsd,
              unit_price_ars: unitPriceArs,
              discount_percent: discountPercent,
              line_total: lineTotal,
              created_at: now,
            };
          });

          const taxAmount = netAmountArs * TAX_RATE;
          const totalAmount = netAmountArs + taxAmount;

          // Create new invoice items
          await tx.invoice_items.createMany({
            data: newInvoiceItems,
          });

          // Update invoice with new totals
          await tx.invoices.update({
            where: { id: invoice.id },
            data: {
              net_amount: netAmountArs,
              tax_amount: taxAmount,
              total_amount: totalAmount,
              updated_at: now,
            },
          });
        }

        // Update delivery notes if any exist (instead of regenerating)
        for (const deliveryNote of unprintedDeliveryNotes) {
          // Delete old delivery note items
          await tx.delivery_note_items.deleteMany({
            where: { delivery_note_id: deliveryNote.id },
          });

          // Create new delivery note items from updated order
          const newDeliveryItems = createdItems.map((item) => ({
            delivery_note_id: deliveryNote.id,
            article_id: item.article_id,
            article_code: item.articles.code,
            article_description: item.articles.description,
            quantity: item.quantity,
            created_at: now,
          }));

          await tx.delivery_note_items.createMany({
            data: newDeliveryItems,
          });

          // Update delivery note timestamp
          await tx.delivery_notes.update({
            where: { id: deliveryNote.id },
            data: {
              updated_at: now,
            },
          });
        }

        // Return the full sales order with relations
        return await tx.sales_orders.findUnique({
          where: { id: salesOrder.id },
          include: {
            clients: true,
            sales_order_items: {
              include: {
                articles: true,
              },
            },
          },
        });
      });

      if (!result) {
        throw new Error('Failed to update sales order');
      }

      // Build update info for response
      const updateInfo = (unprintedInvoices.length > 0 || unprintedDeliveryNotes.length > 0) ? {
        invoices: unprintedInvoices.length,
        deliveryNotes: unprintedDeliveryNotes.length,
        message: `Se actualizaron automáticamente ${unprintedInvoices.length} factura(s) y ${unprintedDeliveryNotes.length} remito(s) no impreso(s)`,
      } : undefined;

      // Convert BigInt to string for JSON serialization
      const serializedSalesOrder = {
        ...result,
        id: result.id.toString(),
        client_id: result.client_id.toString(),
        clients: {
          ...result.clients,
          id: result.clients.id.toString(),
        },
        sales_order_items: result.sales_order_items.map((item: typeof result.sales_order_items[number]) => ({
          ...item,
          id: item.id.toString(),
          sales_order_id: item.sales_order_id.toString(),
          article_id: item.article_id.toString(),
          articles: {
            ...item.articles,
            id: item.articles.id.toString(),
            category_id: item.articles.category_id.toString(),
          },
        })),
        regenerated: updateInfo,
      };

      // Log activity
      await logActivity({
        request,
        operation: OPERATIONS.ORDER_UPDATE,
        description: `Pedido ${serializedSalesOrder.order_number} actualizado para cliente ${serializedSalesOrder.clients.business_name}`,
        entityType: 'sales_order',
        entityId: id,
        details: { total: Number(serializedSalesOrder.total), itemsCount: serializedSalesOrder.sales_order_items.length }
      });

      return NextResponse.json(serializedSalesOrder);
    } else {
      // Update only the sales order fields without items
      const salesOrder = await prisma.sales_orders.update({
        where: { id },
        data: {
          client_id: validatedData.clientId,
          status: validatedData.status,
          special_discount_percent: validatedData.specialDiscountPercent,
          notes: validatedData.notes,
          updated_at: now,
        },
        include: {
          clients: true,
          sales_order_items: {
            include: {
              articles: true,
            },
          },
        },
      });

      // Convert BigInt to string for JSON serialization
      const serializedSalesOrder = {
        ...salesOrder,
        id: salesOrder.id.toString(),
        client_id: salesOrder.client_id.toString(),
        clients: {
          ...salesOrder.clients,
          id: salesOrder.clients.id.toString(),
        },
        sales_order_items: salesOrder.sales_order_items.map((item: typeof salesOrder.sales_order_items[number]) => ({
          ...item,
          id: item.id.toString(),
          sales_order_id: item.sales_order_id.toString(),
          article_id: item.article_id.toString(),
          articles: {
            ...item.articles,
            id: item.articles.id.toString(),
            category_id: item.articles.category_id.toString(),
          },
        })),
      };

      // Log activity
      await logActivity({
        request,
        operation: OPERATIONS.ORDER_UPDATE,
        description: `Pedido ${serializedSalesOrder.order_number} actualizado para cliente ${serializedSalesOrder.clients.business_name}`,
        entityType: 'sales_order',
        entityId: id,
        details: { total: Number(serializedSalesOrder.total), itemsCount: serializedSalesOrder.sales_order_items.length }
      });

      return NextResponse.json(serializedSalesOrder);
    }
  } catch (error) {
    console.error('Error updating sales order:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update sales order' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    // Check if sales order exists and is not already deleted
    const existingSalesOrder = await prisma.sales_orders.findUnique({
      where: { id },
      include: {
        invoices: {
          where: { deleted_at: null },
          orderBy: { created_at: 'desc' },
        },
        delivery_notes: {
          where: { deleted_at: null },
        },
        sales_order_items: {
          include: {
            articles: true,
          },
        },
      },
    });

    if (!existingSalesOrder || existingSalesOrder.deleted_at) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      );
    }

    const now = new Date();

    // Track affected invoices and delivery notes for response
    const affectedInvoiceIds: string[] = [];
    const affectedDeliveryNoteIds: string[] = [];
    const cancelledInvoices: Array<{ id: string; invoiceNumber: string; wasCancelled: boolean }> = [];

    // Process invoices and delivery notes in transaction
    await prisma.$transaction(async (tx) => {
      // Handle invoices
      for (const invoice of existingSalesOrder.invoices) {
        affectedInvoiceIds.push(invoice.id.toString());
        
        if (invoice.is_cancelled) {
          // Skip cancelled invoices
          continue;
        }

        if (invoice.is_printed) {
          // Cancel the invoice and restore stock
          await tx.invoices.update({
            where: { id: invoice.id },
            data: {
              is_cancelled: true,
              cancelled_at: now,
              cancellation_reason: 'Pedido eliminado',
              updated_at: now,
            },
          });

          cancelledInvoices.push({
            id: invoice.id.toString(),
            invoiceNumber: invoice.invoice_number,
            wasCancelled: true,
          });

          // Restore stock for each item (credit movement)
          for (const item of existingSalesOrder.sales_order_items) {
            // Create positive stock movement (return to stock)
            await tx.stock_movements.create({
              data: {
                article_id: item.article_id,
                movement_type: STOCK_MOVEMENT_TYPES.CREDIT,
                quantity: item.quantity,
                reference_document: `Cancelación factura ${invoice.invoice_number} - Pedido eliminado`,
                movement_date: now,
                notes: `Stock devuelto por cancelación de factura al eliminar pedido ${existingSalesOrder.order_number}`,
                created_at: now,
                updated_at: now,
              },
            });

            // Update article stock
            await tx.articles.update({
              where: { id: item.article_id },
              data: {
                stock: {
                  increment: item.quantity,
                },
                updated_at: now,
              },
            });
          }
        } else {
          // Soft delete non-printed invoices
          await tx.invoices.update({
            where: { id: invoice.id },
            data: {
              deleted_at: now,
              updated_at: now,
            },
          });

          cancelledInvoices.push({
            id: invoice.id.toString(),
            invoiceNumber: invoice.invoice_number,
            wasCancelled: false,
          });
        }
      }

      // Soft delete all delivery notes
      for (const deliveryNote of existingSalesOrder.delivery_notes) {
        affectedDeliveryNoteIds.push(deliveryNote.id.toString());
        
        await tx.delivery_notes.update({
          where: { id: deliveryNote.id },
          data: {
            deleted_at: now,
            updated_at: now,
          },
        });
      }

      // Delete items (hard delete since they don't have deleted_at column)
      await tx.sales_order_items.deleteMany({
        where: { sales_order_id: id },
      });

      // Soft delete sales order
      await tx.sales_orders.update({
        where: { id },
        data: {
          deleted_at: now,
          updated_at: now,
        },
      });
    });

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.ORDER_DELETE,
      description: `Pedido ${existingSalesOrder.order_number} eliminado`,
      entityType: 'sales_order',
      entityId: id,
      details: { 
        orderNumber: existingSalesOrder.order_number,
        affectedInvoices: cancelledInvoices.length,
        affectedDeliveryNotes: affectedDeliveryNoteIds.length 
      }
    });

    return NextResponse.json(
      { 
        message: 'Sales order deleted successfully',
        affectedInvoices: cancelledInvoices,
        affectedDeliveryNotes: affectedDeliveryNoteIds,
        orderNumber: existingSalesOrder.order_number,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting sales order:', error);
    return NextResponse.json(
      { error: 'Failed to delete sales order' },
      { status: 500 }
    );
  }
}

