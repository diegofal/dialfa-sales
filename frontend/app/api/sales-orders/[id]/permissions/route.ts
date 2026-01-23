import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as SalesOrderService from '@/lib/services/SalesOrderService';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await SalesOrderService.getPermissions(BigInt(id));

    if (!result) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
