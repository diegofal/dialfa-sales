import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';
import { logActivity } from '@/lib/utils/activityLogger';

const updatePaymentTermSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  days: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);

    const paymentTerm = await prisma.payment_terms.findUnique({ where: { id } });

    if (!paymentTerm) {
      return NextResponse.json({ error: 'Payment term not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: paymentTerm.id,
      code: paymentTerm.code,
      name: paymentTerm.name,
      days: paymentTerm.days,
      isActive: paymentTerm.is_active,
      createdAt: paymentTerm.created_at.toISOString(),
      updatedAt: paymentTerm.updated_at.toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);
    const body = await request.json();
    const validatedData = updatePaymentTermSchema.parse(body);

    const existing = await prisma.payment_terms.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Payment term not found' }, { status: 404 });
    }

    if (validatedData.code && validatedData.code !== existing.code) {
      const codeExists = await prisma.payment_terms.findUnique({
        where: { code: validatedData.code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: 'Payment term with this code already exists' },
          { status: 400 }
        );
      }
    }

    const paymentTerm = await prisma.payment_terms.update({
      where: { id },
      data: {
        ...(validatedData.code && { code: validatedData.code }),
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.days !== undefined && { days: validatedData.days }),
        ...(validatedData.isActive !== undefined && { is_active: validatedData.isActive }),
        updated_at: new Date(),
      },
    });

    await logActivity({
      request,
      operation: OPERATIONS.PAYMENT_TERM_UPDATE,
      description: `Condición de pago ${paymentTerm.name} actualizada`,
      entityType: 'payment_term',
      entityId: BigInt(id),
      details: { code: paymentTerm.code, name: paymentTerm.name },
    });

    return NextResponse.json({
      id: paymentTerm.id,
      code: paymentTerm.code,
      name: paymentTerm.name,
      days: paymentTerm.days,
      isActive: paymentTerm.is_active,
      createdAt: paymentTerm.created_at.toISOString(),
      updatedAt: paymentTerm.updated_at.toISOString(),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = parseInt(paramId);

    const existing = await prisma.payment_terms.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            invoices: true,
            sales_orders: true,
            category_payment_discounts: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Payment term not found' }, { status: 404 });
    }

    const totalUsage =
      existing._count.invoices +
      existing._count.sales_orders +
      existing._count.category_payment_discounts;
    if (totalUsage > 0) {
      return NextResponse.json(
        { error: 'Cannot delete payment term that is being used' },
        { status: 400 }
      );
    }

    await prisma.payment_terms.delete({ where: { id } });

    await logActivity({
      request,
      operation: OPERATIONS.PAYMENT_TERM_DELETE,
      description: `Condición de pago ${existing.name} eliminada`,
      entityType: 'payment_term',
      entityId: BigInt(id),
      details: { code: existing.code, name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
