import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as PriceListService from '@/lib/services/PriceListService';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const draft = await PriceListService.getDraft(user.userId);
    return NextResponse.json({ draft });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = await PriceListService.saveDraft(user.userId, body.draftData);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await PriceListService.deleteDraft(user.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
