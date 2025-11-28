import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pdfService } from '@/lib/services/PDFService';
import { loadTemplate } from '@/lib/print-templates/template-loader';

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
                sales_orders: {
                    include: {
                        clients: {
                            include: {
                                provinces: true,
                                tax_conditions: true,
                            }
                        },
                        sales_order_items: {
                            include: {
                                articles: true
                            }
                        }
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

        // 3. Marcar como impreso y ejecutar lógica de negocio
        await prisma.$transaction(async (tx) => {
            await tx.invoices.update({
                where: { id: invoiceId },
                data: {
                    is_printed: true,
                    printed_at: new Date(),
                    updated_at: new Date(),
                }
            });
        });

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
