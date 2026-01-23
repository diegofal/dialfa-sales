import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as InvoiceService from '@/lib/services/InvoiceService';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await InvoiceService.updateExchangeRate(
      BigInt(id),
      body.usdExchangeRate,
      request
    );

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    return handleError(error);
  }
}
