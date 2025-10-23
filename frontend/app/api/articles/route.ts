import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapArticleToDTO } from '@/lib/utils/mapper';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId');
    const isActive = searchParams.get('isActive');

    const skip = (page - 1) * limit;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      deleted_at: null,
    };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.category_id = BigInt(categoryId);
    }

    if (isActive !== null && isActive !== undefined) {
      where.is_active = isActive === 'true';
    }

    // Get articles with category
    const [articles, total] = await Promise.all([
      prisma.articles.findMany({
        where,
        include: {
          categories: true,
        },
        orderBy: [
          { display_order: 'asc' },
          { code: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.articles.count({ where }),
    ]);

    // Map to DTO format (snake_case to camelCase)
    const mappedArticles = articles.map(mapArticleToDTO);

    return NextResponse.json({
      data: mappedArticles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}


