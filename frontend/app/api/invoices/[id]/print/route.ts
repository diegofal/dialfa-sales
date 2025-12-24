import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pdfService } from '@/lib/services/PDFService';
import { loadTemplate } from '@/lib/print-templates/template-loader';
import { STOCK_MOVEMENT_TYPES } from '@/lib/constants/stockMovementTypes';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const invoiceId = parseInt(id);

        // 1. Cargar y validar factura
        const invoice = await prisma.invoices.findUnique({
            where: { id: invoiceId },
            include: {
                invoice_items: {
                    include: {
                        articles: true
                    },
                    orderBy: {
                        id: 'asc'
                    }
                },
                sales_orders: {
                    include: {
                        clients: {
                            include: {
                                provinces: true,
                                tax_conditions: true,
                            }
                        },
                        sales_order_items: true
                    }
                }
            }
        });

        if (!invoice || invoice.deleted_at) {
            return NextResponse.json(
                { error: 'Invoice not found' },
                { status: 404 }
            );
        }

        if (invoice.is_cancelled) {
            return NextResponse.json(
                { error: 'Cannot print cancelled invoice' },
                { status: 400 }
            );
        }

        // 2. Generar PDF
        const template = await loadTemplate('invoice', 'default');
        const pdfBuffer = await pdfService.generateInvoicePDF(
            invoice,
            template
        );

        // 3. Marcar como impreso y ejecutar lógica de negocio (crear movimientos de stock)
        const tracker = new ChangeTracker();
        await tracker.trackBefore('invoice', invoiceId);
        
        const now = new Date();
        const isPrintingNow = !invoice.is_printed; // Only create movements if printing for the first time

        await prisma.$transaction(async (tx) => {
            // If printing the invoice for the first time, debit stock
            if (isPrintingNow && invoice.sales_orders) {
                const salesOrder = await tx.sales_orders.findUnique({
                    where: { id: invoice.sales_orders.id },
                    include: {
                        sales_order_items: true,
                    },
                });

                if (salesOrder) {
                    for (const item of salesOrder.sales_order_items) {
                        await tracker.trackBefore('article', item.article_id);
                        
                        // Create negative stock movement (debit from stock)
                        await tx.stock_movements.create({
                            data: {
                                article_id: item.article_id,
                                movement_type: STOCK_MOVEMENT_TYPES.DEBIT,
                                quantity: item.quantity,
                                reference_document: `Impresión factura ${invoice.invoice_number}`,
                                movement_date: now,
                                notes: `Stock debitado por impresión de factura`,
                                created_at: now,
                                updated_at: now,
                            },
                        });

                        // Update article stock
                        await tx.articles.update({
                            where: { id: item.article_id },
                            data: {
                                stock: {
                                    decrement: item.quantity,
                                },
                                updated_at: now,
                            },
                        });
                        
                        await tracker.trackAfter('article', item.article_id);
                    }
                }
            }

            // Mark invoice as printed
            await tx.invoices.update({
                where: { id: invoiceId },
                data: {
                    is_printed: true,
                    printed_at: invoice.is_printed ? invoice.printed_at : now,
                    updated_at: now,
                }
            });
        });

        await tracker.trackAfter('invoice', invoiceId);

        // Log activity
        const activityLogId = await logActivity({
            request,
            operation: OPERATIONS.INVOICE_PRINT,
            description: `Factura ${invoice.invoice_number} impresa`,
            entityType: 'invoice',
            entityId: invoiceId,
            details: { invoiceNumber: invoice.invoice_number }
        });

        if (activityLogId) {
            await tracker.saveChanges(activityLogId);
        }

        // 4. Retornar PDF
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="factura-${invoice.invoice_number}.pdf"`,
                'Cache-Control': 'no-cache',
            },
        });

    } catch (error) {
        console.error('Error printing invoice:', error);
        return NextResponse.json(
            { error: 'Failed to print invoice' },
            { status: 500 }
        );
    }
}
