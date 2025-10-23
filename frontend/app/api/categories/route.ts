import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CategoryWhereInput } from '@/lib/types';
import { mapCategoryToDTO } from '@/lib/utils/mapper';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');

    const skip = (page - 1) * limit;

    const where: CategoryWhereInput = {
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
        orderBy: {
          code: 'asc',
        },
        skip,
        take: limit,
      }),
      prisma.categories.count({ where }),
    ]);

    // Map to DTO format (snake_case to camelCase)
    const mappedCategories = categories.map(mapCategoryToDTO);

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
