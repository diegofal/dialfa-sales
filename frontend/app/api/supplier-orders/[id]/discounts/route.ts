import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as SupplierOrderService from '@/lib/services/SupplierOrderService';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAdmin(request);
    if (!auth.authorized) return auth.error;

    const { id } = await params;
    const body = await request.json();

    const { useCategoryDiscounts, items } = body as {
      useCategoryDiscounts: boolean;
      items: { articleId: number; discountPercent: number }[];
    };

    const result = await SupplierOrderService.updateDiscounts(
      BigInt(id),
      useCategoryDiscounts,
      items
    );

    return NextResponse.json({ success: true }, { status: result.status });
  } catch (error) {
    return handleError(error);
  }
}
