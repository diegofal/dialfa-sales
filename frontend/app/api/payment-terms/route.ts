import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

const createPaymentTermSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  days: z.number().int().min(0),
  isActive: z.boolean().optional().default(true),
});

const updatePaymentTermSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  days: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('activeOnly');

    const where: Record<string, unknown> = {};

    if (activeOnly === 'true') {
      where.is_active = true;
    }

    const paymentTerms = await prisma.payment_terms.findMany({
      where,
      orderBy: {
        days: 'asc',
      },
    });

    // Map to camelCase
    const mappedTerms = paymentTerms.map(term => ({
      id: term.id,
      code: term.code,
      name: term.name,
      days: term.days,
      isActive: term.is_active,
      createdAt: term.created_at.toISOString(),
      updatedAt: term.updated_at.toISOString(),
    }));

    return NextResponse.json({
      data: mappedTerms,
    });
  } catch (error) {
    console.error('Error fetching payment terms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment terms' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = createPaymentTermSchema.parse(body);

    // Check if code already exists
    const existing = await prisma.payment_terms.findUnique({
      where: { code: validatedData.code },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Payment term with this code already exists' },
        { status: 400 }
      );
    }

    const paymentTerm = await prisma.payment_terms.create({
      data: {
        code: validatedData.code,
        name: validatedData.name,
        days: validatedData.days,
        is_active: validatedData.isActive,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Map to camelCase
    const mappedTerm = {
      id: paymentTerm.id,
      code: paymentTerm.code,
      name: paymentTerm.name,
      days: paymentTerm.days,
      isActive: paymentTerm.is_active,
      createdAt: paymentTerm.created_at.toISOString(),
      updatedAt: paymentTerm.updated_at.toISOString(),
    };

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.PAYMENT_TERM_CREATE,
      description: `Condición de pago ${paymentTerm.name} (${paymentTerm.code}) creada`,
      entityType: 'payment_term',
      entityId: BigInt(paymentTerm.id),
      details: { code: paymentTerm.code, name: paymentTerm.name, days: paymentTerm.days }
    });

    return NextResponse.json(mappedTerm, { status: 201 });
  } catch (error) {
    console.error('Error creating payment term:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create payment term' },
      { status: 500 }
    );
  }
}

