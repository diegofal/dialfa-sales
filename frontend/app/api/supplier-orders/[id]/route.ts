import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as SupplierOrderService from '@/lib/services/SupplierOrderService';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const order = await SupplierOrderService.getById(BigInt(id));

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAdmin(request);
    if (!auth.authorized) return auth.error;
    const user = auth.user;

    const { id } = await params;
    const body = await request.json();
    const result = await SupplierOrderService.update(BigInt(id), body, user.userId!, request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAdmin(request);
    if (!auth.authorized) return auth.error;
    const user = auth.user;

    const { id } = await params;
    const result = await SupplierOrderService.remove(BigInt(id), user.userId!, request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
