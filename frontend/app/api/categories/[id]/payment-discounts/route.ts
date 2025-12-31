import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

const upsertDiscountsSchema = z.array(z.object({
  paymentTermId: z.number().int(),
  discountPercent: z.number().min(0).max(100),
}));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = BigInt(id);

    // Get all payment terms with discounts for this category
    const paymentTerms = await prisma.payment_terms.findMany({
      where: {
        is_active: true,
      },
      include: {
        category_payment_discounts: {
          where: {
            category_id: categoryId,
          },
        },
      },
      orderBy: {
        days: 'asc',
      },
    });

    // Map to a more usable format
    const discounts = paymentTerms.map(term => ({
      paymentTermId: term.id,
      paymentTermCode: term.code,
      paymentTermName: term.name,
      paymentTermDays: term.days,
      discountPercent: term.category_payment_discounts[0]?.discount_percent 
        ? Number(term.category_payment_discounts[0].discount_percent)
        : 0,
    }));

    return NextResponse.json({
      data: discounts,
    });
  } catch (error) {
    console.error('Error fetching category payment discounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category payment discounts' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = BigInt(id);
    const body = await request.json();

    // Validate input
    const validatedData = upsertDiscountsSchema.parse(body);

    // Check if category exists
    const category = await prisma.categories.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Use transaction to update all discounts
    await prisma.$transaction(async (tx) => {
      // Delete all existing discounts for this category
      await tx.category_payment_discounts.deleteMany({
        where: {
          category_id: categoryId,
        },
      });

      // Create new discounts (only if discount > 0)
      const discountsToCreate = validatedData
        .filter(d => d.discountPercent > 0)
        .map(d => ({
          category_id: categoryId,
          payment_term_id: d.paymentTermId,
          discount_percent: d.discountPercent,
          created_at: new Date(),
          updated_at: new Date(),
        }));

      if (discountsToCreate.length > 0) {
        await tx.category_payment_discounts.createMany({
          data: discountsToCreate,
        });
      }
    });

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.CATEGORY_UPDATE,
      description: `Descuentos por condición de pago actualizados para categoría ${category.name}`,
      entityType: 'category',
      entityId: categoryId,
      details: { 
        categoryCode: category.code, 
        categoryName: category.name,
        discountsCount: validatedData.filter(d => d.discountPercent > 0).length
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating category payment discounts:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update category payment discounts' },
      { status: 500 }
    );
  }
}

