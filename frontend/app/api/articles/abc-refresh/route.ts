import { NextRequest, NextResponse } from 'next/server';
import { RESOURCES, ACTIONS } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as ArticleService from '@/lib/services/ArticleService';

export async function POST(request: NextRequest) {
  try {
    const auth = requirePermission(request, RESOURCES.ARTICLES, ACTIONS.ABC_REFRESH);
    if (!auth.authorized) return auth.error;

    const result = await ArticleService.refreshABC();
    return NextResponse.json({
      success: true,
      message: 'Clasificación ABC actualizada',
      ...result,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET() {
  try {
    const info = ArticleService.getABCInfo();
    return NextResponse.json({ success: true, cache: info });
  } catch (error) {
    return handleError(error);
  }
}
