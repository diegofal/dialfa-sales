import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as StockSnapshotService from '@/lib/services/StockSnapshotService';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');

    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await StockSnapshotService.createSnapshot();

    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
