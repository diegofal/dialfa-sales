import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as StockSnapshotService from '@/lib/services/StockSnapshotService';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const months = parseInt(request.nextUrl.searchParams.get('months') || '12');
    const type = request.nextUrl.searchParams.get('type');

    if (type === 'category') {
      const categoryData = await StockSnapshotService.getCategorySnapshots(months);
      return NextResponse.json({
        data: categoryData,
        status: 'success',
      });
    }

    const snapshots = await StockSnapshotService.getSnapshots(months);

    return NextResponse.json({
      data: snapshots,
      total_records: snapshots.length,
      status: 'success',
    });
  } catch (error) {
    return handleError(error);
  }
}
