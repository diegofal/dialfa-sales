import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapCategoryToDTO } from '@/lib/utils/mapper';
import { createCategorySchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');

    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      deleted_at: null,
    };

    if (isActive !== null && isActive !== undefined) {
      where.is_active = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [categories, total] = await Promise.all([
      prisma.categories.findMany({
        where,
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
        orderBy: {
          code: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.categories.count({ where }),
    ]);

    // Map to DTO format (snake_case to camelCase)
    const mappedCategories = categories.map(c => ({
      ...mapCategoryToDTO(c),
      articlesCount: c._count?.articles || 0,
    }));

    return NextResponse.json({
      data: mappedCategories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = createCategorySchema.parse(body);

    // Convert camelCase to snake_case for Prisma
    const category = await prisma.categories.create({
      data: {
        code: validatedData.code,
        name: validatedData.name,
        description: validatedData.description,
        default_discount_percent: validatedData.defaultDiscountPercent,
        is_active: validatedData.isActive ?? true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Map to DTO format
    const mappedCategory = mapCategoryToDTO(category);

    // Track creation
    const tracker = new ChangeTracker();
    tracker.trackCreate('category', category.id, category);

    // Log activity
    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.CATEGORY_CREATE,
      description: `Categoría ${category.name} (${category.code}) creada`,
      entityType: 'category',
      entityId: category.id,
      details: { code: category.code, name: category.name }
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

    return NextResponse.json(mappedCategory, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
