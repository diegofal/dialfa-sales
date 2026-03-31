import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as CustomerSyncService from '@/lib/services/CustomerSyncService';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');

    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await CustomerSyncService.runSync();

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
