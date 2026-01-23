import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as DeliveryNoteService from '@/lib/services/DeliveryNoteService';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await DeliveryNoteService.print(BigInt(id), request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return new NextResponse(new Uint8Array(result.data), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="remito-${id}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
