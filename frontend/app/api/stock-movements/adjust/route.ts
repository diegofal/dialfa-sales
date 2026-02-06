import { NextRequest, NextResponse } from 'next/server';
import { RESOURCES, ACTIONS } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as ArticleService from '@/lib/services/ArticleService';

export async function POST(request: NextRequest) {
  try {
    const auth = requirePermission(request, RESOURCES.STOCK_MOVEMENTS, ACTIONS.ADJUST);
    if (!auth.authorized) return auth.error;

    const body = await request.json();
    const result = await ArticleService.adjustStock(body, request);

    if (!result) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
