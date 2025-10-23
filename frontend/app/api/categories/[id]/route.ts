import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

