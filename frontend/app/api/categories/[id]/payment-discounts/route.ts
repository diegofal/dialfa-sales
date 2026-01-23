import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as CategoryService from '@/lib/services/CategoryService';

const upsertDiscountsSchema = z.array(
  z.object({
    paymentTermId: z.number().int(),
    discountPercent: z.number().min(0).max(100),
  })
);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const discounts = await CategoryService.getPaymentDiscounts(BigInt(id));

    return NextResponse.json({ data: discounts });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request);
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = upsertDiscountsSchema.parse(body);
    const result = await CategoryService.updatePaymentDiscounts(BigInt(id), validatedData, request);

    if (!result) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
