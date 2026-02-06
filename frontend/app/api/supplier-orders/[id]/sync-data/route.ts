import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as SupplierOrderService from '@/lib/services/SupplierOrderService';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAdmin(request);
    if (!auth.authorized) return auth.error;
    const user = auth.user;

    const { id } = await params;
    const body = await request.json();
    const result = await SupplierOrderService.syncData(
      BigInt(id),
      body.cifPercentage ?? null,
      user.userId!,
      request
    );

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, ...result.data });
  } catch (error) {
    return handleError(error);
  }
}
