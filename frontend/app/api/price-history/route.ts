import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/roles';

export async function GET(request: NextRequest) {
  try {
    const { authorized, error } = requireAdmin(request);
    if (!authorized) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const articleId = searchParams.get('articleId');
    const categoryId = searchParams.get('categoryId');
    const changeType = searchParams.get('changeType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    if (articleId) {
      where.article_id = BigInt(articleId);
    }

    if (changeType) {
      where.change_type = changeType;
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    // Si hay filtro por categoría, necesitamos join con articles
    if (categoryId) {
      where.articles = {
        category_id: BigInt(categoryId),
        deleted_at: null,
      };
    }

    const [history, total] = await Promise.all([
      prisma.price_history.findMany({
        where,
        include: {
          articles: {
            select: {
              id: true,
              code: true,
              description: true,
              category_id: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.price_history.count({ where }),
    ]);

    const data = history.map(h => ({
      id: Number(h.id),
      articleId: Number(h.article_id),
      articleCode: h.articles.code,
      articleDescription: h.articles.description,
      oldPrice: Number(h.old_price),
      newPrice: Number(h.new_price),
      changeType: h.change_type,
      changeBatchId: h.change_batch_id || undefined,
      changedBy: h.changed_by || undefined,
      changedByName: h.changed_by_name || undefined,
      notes: h.notes || undefined,
      createdAt: h.created_at.toISOString(),
      priceChange: Number(h.new_price) - Number(h.old_price),
      priceChangePercent: ((Number(h.new_price) - Number(h.old_price)) / Number(h.old_price)) * 100,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price history' },
      { status: 500 }
    );
  }
}

