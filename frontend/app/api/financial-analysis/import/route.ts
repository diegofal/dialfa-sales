import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import { parseBankExtract } from '@/lib/utils/financialImport/bankExtractParser';
import { parsePlanillaDiaria } from '@/lib/utils/financialImport/planillaDiariaParser';
import { parseSalarios } from '@/lib/utils/financialImport/salariosParser';
import type { ImportSource } from '@/lib/utils/financialImport/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as ImportSource | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }
    if (!type || !['bank_extract', 'planilla_diaria', 'salarios'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo inválido. Use: bank_extract, planilla_diaria, salarios' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Archivo excede 10MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let result;
    switch (type) {
      case 'bank_extract':
        result = parseBankExtract(buffer);
        break;
      case 'planilla_diaria':
        result = parsePlanillaDiaria(buffer);
        break;
      case 'salarios':
        result = parseSalarios(buffer);
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
