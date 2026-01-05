import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

const updatePaymentTermSchema = z.object({
  paymentTermId: z.coerce.number().int().min(1, 'Payment term ID is required'),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);
    const body = await request.json();

    // Check if client exists
    const existingClient = await prisma.clients.findUnique({
      where: { id },
    });

    if (!existingClient || existingClient.deleted_at) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Validate input
    const { paymentTermId } = updatePaymentTermSchema.parse(body);

    // Update only payment_term_id
    const updatedClient = await prisma.clients.update({
      where: { id },
      data: {
        payment_term_id: paymentTermId,
        updated_at: new Date(),
      },
      include: {
        payment_terms: true,
      },
    });

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.CLIENT_UPDATE,
      description: `Condición de pago actualizada para cliente ${existingClient.business_name}`,
      entityType: 'client',
      entityId: id,
      details: { 
        field: 'payment_term_id',
        oldValue: existingClient.payment_term_id,
        newValue: paymentTermId 
      }
    });

    return NextResponse.json({
      success: true,
      paymentTermId: updatedClient.payment_term_id,
      paymentTermName: updatedClient.payment_terms?.name,
    });
  } catch (error) {
    console.error('Error updating client payment term:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update payment term' },
      { status: 500 }
    );
  }
}
