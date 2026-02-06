import { NextRequest, NextResponse } from 'next/server';
import { RESOURCES, ACTIONS } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as ArticleService from '@/lib/services/ArticleService';
import { updateArticleSchema } from '@/lib/validations/schemas';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const article = await ArticleService.getById(BigInt(id));

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requirePermission(request, RESOURCES.ARTICLES, ACTIONS.UPDATE);
    if (!auth.authorized) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateArticleSchema.parse(body);
    const article = await ArticleService.update(BigInt(id), validatedData, request);

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requirePermission(request, RESOURCES.ARTICLES, ACTIONS.DELETE);
    if (!auth.authorized) return auth.error;

    const { id } = await params;
    const result = await ArticleService.remove(BigInt(id), request);

    if (!result) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
