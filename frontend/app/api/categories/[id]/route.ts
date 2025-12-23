import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapCategoryToDTO } from '@/lib/utils/mapper';
import { updateCategorySchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    const category = await prisma.categories.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            articles: {
              where: {
                deleted_at: null,
                is_active: true,
              },
            },
          },
        },
      },
    });

    if (!category || category.deleted_at) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Convert BigInt to string and map to DTO format
    const mappedCategory = {
      ...mapCategoryToDTO(category),
      articlesCount: category._count?.articles || 0,
    };
    
    return NextResponse.json(mappedCategory);
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);
    const body = await request.json();

    // Check if category exists and is not deleted
    const existingCategory = await prisma.categories.findUnique({
      where: { id },
    });

    if (!existingCategory || existingCategory.deleted_at) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Validate input
    const validatedData = updateCategorySchema.parse(body);

    // Convert camelCase to snake_case for Prisma
    const category = await prisma.categories.update({
      where: { id },
      data: {
        code: validatedData.code,
        name: validatedData.name,
        description: validatedData.description,
        default_discount_percent: validatedData.defaultDiscountPercent,
        is_active: validatedData.isActive,
        updated_at: new Date(),
      },
    });

    // Convert BigInt to string and map to DTO format
    const mappedCategory = mapCategoryToDTO(category);
    
    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.CATEGORY_UPDATE,
      description: `Categoría ${category.name} (${category.code}) actualizada`,
      entityType: 'category',
      entityId: id,
      details: { code: category.code, name: category.name }
    });
    
    return NextResponse.json(mappedCategory);
  } catch (error) {
    console.error('Error updating category:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    // Check if category exists and is not already deleted
    const existingCategory = await prisma.categories.findUnique({
      where: { id },
    });

    if (!existingCategory || existingCategory.deleted_at) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Soft delete: mark as deleted
    await prisma.categories.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.CATEGORY_DELETE,
      description: `Categoría ${existingCategory.name} (${existingCategory.code}) eliminada`,
      entityType: 'category',
      entityId: id,
      details: { code: existingCategory.code, name: existingCategory.name }
    });

    return NextResponse.json(
      { message: 'Category deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}

