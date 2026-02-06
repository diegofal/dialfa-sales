import { NextRequest, NextResponse } from 'next/server';
import { RESOURCES, ACTIONS } from '@/lib/auth/permissions';
import { requirePermission } from '@/lib/auth/roles';
import { handleError } from '@/lib/errors';
import * as CategoryService from '@/lib/services/CategoryService';
import { createCategorySchema } from '@/lib/validations/schemas';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const result = await CategoryService.list({
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
      search: searchParams.get('search') || undefined,
      isActive: searchParams.get('isActive') || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requirePermission(request, RESOURCES.CATEGORIES, ACTIONS.CREATE);
    if (!auth.authorized) return auth.error;

    const body = await request.json();
    const validatedData = createCategorySchema.parse(body);
    const category = await CategoryService.create(validatedData, request);

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
