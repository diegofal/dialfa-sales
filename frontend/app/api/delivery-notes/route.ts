import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as DeliveryNoteService from '@/lib/services/DeliveryNoteService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const salesOrderId = searchParams.get('salesOrderId') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    const result = await DeliveryNoteService.list({ page, limit, salesOrderId, fromDate, toDate });
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await DeliveryNoteService.create(body, request);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: result.status });
  } catch (error) {
    return handleError(error);
  }
}
