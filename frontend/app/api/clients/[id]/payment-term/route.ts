import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as ClientService from '@/lib/services/ClientService';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await ClientService.updatePaymentTerm(BigInt(id), body.paymentTermId, request);

    if (!result) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
