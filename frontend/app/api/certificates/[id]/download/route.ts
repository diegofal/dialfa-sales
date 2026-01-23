import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as CertificateService from '@/lib/services/CertificateService';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await CertificateService.getDownloadUrl(BigInt(id));

    if (!result) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
    }

    return NextResponse.json({
      signedUrl: result.signedUrl,
      fileName: result.fileName,
    });
  } catch (error) {
    return handleError(error);
  }
}
