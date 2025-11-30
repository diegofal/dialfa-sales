import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pdfService } from '@/lib/services/PDFService';
import { loadTemplate } from '@/lib/print-templates/template-loader';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const deliveryNoteId = BigInt(id);

        const deliveryNote = await prisma.delivery_notes.findUnique({
            where: { id: deliveryNoteId },
            include: {
                sales_orders: {
                    include: {
                        clients: {
                            include: {
                                provinces: true,
                                tax_conditions: true,
                            }
                        }
                    }
                },
                transporters: true,
                delivery_note_items: {
                    orderBy: {
                        id: 'asc',
                    }
                }
            }
        });

        if (!deliveryNote || deliveryNote.deleted_at) {
            return NextResponse.json(
                { error: 'Delivery note not found' },
                { status: 404 }
            );
        }

        const template = await loadTemplate('delivery-note', 'default');
        const pdfBuffer = await pdfService.generateDeliveryNotePDF(
            deliveryNote,
            template
        );

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="remito-${deliveryNote.delivery_number}.pdf"`,
                'Cache-Control': 'no-cache',
            },
        });

    } catch (error) {
        console.error('Error generating delivery note PDF:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF' },
            { status: 500 }
        );
    }
}

