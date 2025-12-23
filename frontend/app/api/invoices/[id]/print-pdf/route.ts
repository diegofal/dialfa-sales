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

        const template = await loadTemplate('invoice', 'default');
        const pdfBuffer = await pdfService.generateInvoicePDF(
            invoice,
            template
        );

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
