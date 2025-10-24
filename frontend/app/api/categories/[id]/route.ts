import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { updateCategorySchema } from '@/lib/validations/schemas';
import { z } from 'zod';

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
        articles: {
          where: {
            deleted_at: null,
            is_active: true,
          },
          take: 10, // Limit related articles
        },
      },
    });

    if (!category || category.deleted_at) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Convert BigInt to string for JSON serialization
    const serializedCategory = {
      ...category,
      id: category.id.toString(),
      articles: category.articles.map((article: typeof category.articles[number]) => ({
        ...article,
        id: article.id.toString(),
        category_id: article.category_id.toString(),
      })),
    };

    return NextResponse.json(serializedCategory);
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

    // Convert BigInt to string for JSON serialization
    const serializedCategory = {
      ...category,
      id: category.id.toString(),
    };

    return NextResponse.json(serializedCategory);
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

