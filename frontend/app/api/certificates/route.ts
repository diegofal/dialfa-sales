import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as CertificateService from '@/lib/services/CertificateService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const result = await CertificateService.list({
      colada: searchParams.get('colada') || undefined,
      category: searchParams.get('category') || undefined,
      fileType: searchParams.get('fileType') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const coladas = formData.get('coladas') as string | null;
    const category = (formData.get('category') as string) || 'ACCESORIOS';
    const notes = formData.get('notes') as string | null;

    const result = await CertificateService.upload(file, coladas, category, notes);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    return handleError(error);
  }
}
