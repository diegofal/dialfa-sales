import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pdfService } from '@/lib/services/PDFService';
import { loadTemplate } from '@/lib/print-templates/template-loader';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const deliveryNoteId = BigInt(id);

        // 1. Load and validate delivery note
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

        // 2. Generate PDF
        const template = await loadTemplate('delivery-note', 'default');
        const pdfBuffer = await pdfService.generateDeliveryNotePDF(
            deliveryNote,
            template
        );

        // 3. Mark as printed (only if it's the first time)
        const tracker = new ChangeTracker();
        await tracker.trackBefore('delivery_note', deliveryNoteId);
        
        const now = new Date();
        const isPrintingNow = !deliveryNote.is_printed;

        if (isPrintingNow) {
            await prisma.delivery_notes.update({
                where: { id: deliveryNoteId },
                data: {
                    is_printed: true,
                    printed_at: now,
                    updated_at: now,
                }
            });
        }

        await tracker.trackAfter('delivery_note', deliveryNoteId);

        // Log activity
        const activityLogId = await logActivity({
            request,
            operation: OPERATIONS.DELIVERY_PRINT,
            description: `Remito ${deliveryNote.delivery_number} impreso`,
            entityType: 'delivery_note',
            entityId: deliveryNoteId,
            details: { deliveryNumber: deliveryNote.delivery_number }
        });

        if (activityLogId) {
            await tracker.saveChanges(activityLogId);
        }

        // 4. Return PDF
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="remito-${deliveryNote.delivery_number}.pdf"`,
                'Cache-Control': 'no-cache',
            },
        });

    } catch (error) {
        console.error('Error printing delivery note:', error);
        return NextResponse.json(
            { error: 'Failed to print delivery note' },
            { status: 500 }
        );
    }
}


