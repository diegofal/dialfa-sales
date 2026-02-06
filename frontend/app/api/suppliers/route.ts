import { NextRequest, NextResponse } from 'next/server';
import { RESOURCES, ACTIONS } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as SupplierService from '@/lib/services/SupplierService';

export async function GET(request: NextRequest) {
  try {
    const auth = requirePermission(request, RESOURCES.SUPPLIERS, ACTIONS.LIST);
    if (!auth.authorized) return auth.error;

    const searchParams = request.nextUrl.searchParams;
    const suppliers = await SupplierService.list({
      activeOnly: searchParams.get('activeOnly') === 'true',
      searchTerm: searchParams.get('searchTerm') || undefined,
    });

    return NextResponse.json({ success: true, data: suppliers, total: suppliers.length });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requirePermission(request, RESOURCES.SUPPLIERS, ACTIONS.CREATE);
    if (!auth.authorized) return auth.error;

    const body = await request.json();
    if (!body.code || !body.name) {
      return NextResponse.json({ error: 'Código y nombre son requeridos' }, { status: 400 });
    }

    const result = await SupplierService.create(body, auth.user.userId!, request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return handleError(error);
  }
}
