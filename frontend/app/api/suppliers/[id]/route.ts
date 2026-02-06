import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, requireAdmin } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as SupplierService from '@/lib/services/SupplierService';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const supplier = await SupplierService.getById(parseInt(id));

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: supplier });
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
    const result = await SupplierService.update(parseInt(id), body, user.userId!, request);

    if (!result) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
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
    const result = await SupplierService.remove(parseInt(id), user.userId!, request);

    if (!result) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Proveedor eliminado exitosamente' });
  } catch (error) {
    return handleError(error);
  }
}
