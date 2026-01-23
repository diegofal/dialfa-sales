import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as CertificateService from '@/lib/services/CertificateService';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
    }

    const stats = await CertificateService.syncFromExcel(file, request);
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return handleError(error);
  }
}
