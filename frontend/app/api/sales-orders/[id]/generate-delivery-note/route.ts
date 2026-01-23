import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as SalesOrderService from '@/lib/services/SalesOrderService';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await SalesOrderService.generateDeliveryNote(BigInt(id), body, request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    return handleError(error);
  }
}
