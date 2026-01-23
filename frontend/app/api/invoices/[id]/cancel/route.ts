import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as InvoiceService from '@/lib/services/InvoiceService';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await InvoiceService.cancel(BigInt(id), request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
