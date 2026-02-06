import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as SupplierOrderService from '@/lib/services/SupplierOrderService';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAdmin(request);
    if (!auth.authorized) return auth.error;
    const user = auth.user;

    const { id } = await params;
    const body = await request.json();
    const result = await SupplierOrderService.updateStatus(
      BigInt(id),
      body.status,
      user.userId!,
      request
    );

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return handleError(error);
  }
}
