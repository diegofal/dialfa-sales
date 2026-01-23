import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as DeliveryNoteService from '@/lib/services/DeliveryNoteService';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pdfBuffer = await DeliveryNoteService.getPDF(BigInt(id));

    if (!pdfBuffer) {
      return NextResponse.json({ error: 'Delivery note not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
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
