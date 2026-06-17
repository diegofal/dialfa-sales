import { NextRequest, NextResponse } from 'next/server';
import { RESOURCES, ACTIONS } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as ArticleService from '@/lib/services/ArticleService';
import { changeArticlePriceSchema } from '@/lib/validations/schemas';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requirePermission(request, RESOURCES.ARTICLES, ACTIONS.MODIFY_PRICE);
    if (!auth.authorized) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const { newPrice, notes } = changeArticlePriceSchema.parse(body);

    const result = await ArticleService.changePrice(
      { articleId: Number(id), newPrice, notes },
      auth.user.userId,
      auth.user.email,
      request
    );

    if (!result) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
