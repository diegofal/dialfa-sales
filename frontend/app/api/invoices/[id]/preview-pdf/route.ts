import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as InvoiceService from '@/lib/services/InvoiceService';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await InvoiceService.getPDF(BigInt(id));

    if (!result) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(result.pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="preview-factura-${result.invoiceNumber}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
