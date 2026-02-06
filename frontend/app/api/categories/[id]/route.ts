import { NextRequest, NextResponse } from 'next/server';
import { RESOURCES, ACTIONS } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as CategoryService from '@/lib/services/CategoryService';
import { updateCategorySchema } from '@/lib/validations/schemas';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const category = await CategoryService.getById(BigInt(id));

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requirePermission(request, RESOURCES.CATEGORIES, ACTIONS.UPDATE);
    if (!auth.authorized) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateCategorySchema.parse(body);
    const category = await CategoryService.update(BigInt(id), validatedData, request);

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requirePermission(request, RESOURCES.CATEGORIES, ACTIONS.DELETE);
    if (!auth.authorized) return auth.error;

    const { id } = await params;
    const result = await CategoryService.remove(BigInt(id), request);

    if (!result) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    return handleError(error);
  }
}
