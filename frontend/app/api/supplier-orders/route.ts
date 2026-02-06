import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as SupplierOrderService from '@/lib/services/SupplierOrderService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const result = await SupplierOrderService.list({
      status: searchParams.get('status') || undefined,
      supplierId: searchParams.get('supplierId')
        ? parseInt(searchParams.get('supplierId')!)
        : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request);
    if (!auth.authorized) return auth.error;
    const user = auth.user;

    const body = await request.json();
    const result = await SupplierOrderService.create(body, user.userId!, request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    return handleError(error);
  }
}
