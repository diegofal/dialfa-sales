import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errors';
import * as SyncDataService from '@/lib/services/SyncDataService';

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!process.env.PUBLIC_API_KEY || apiKey !== process.env.PUBLIC_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await SyncDataService.getBalances();
    return NextResponse.json({ data, status: 'success' });
  } catch (error) {
    return handleError(error);
  }
}
