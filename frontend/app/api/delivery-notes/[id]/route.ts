import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as DeliveryNoteService from '@/lib/services/DeliveryNoteService';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deliveryNote = await DeliveryNoteService.getById(BigInt(id));

    if (!deliveryNote) {
      return NextResponse.json({ error: 'Delivery note not found' }, { status: 404 });
    }

    return NextResponse.json(deliveryNote);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await DeliveryNoteService.update(BigInt(id), body, request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await DeliveryNoteService.remove(BigInt(id), request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      { message: 'Delivery note deleted successfully' },
      { status: result.status }
    );
  } catch (error) {
    return handleError(error);
  }
}
