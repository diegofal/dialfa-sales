import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapArticleToDTO } from '@/lib/utils/mapper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);

    const article = await prisma.articles.findUnique({
      where: { id },
      include: {
        categories: true,
      },
    });

    if (!article || article.deleted_at) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Map to DTO format (snake_case to camelCase)
    const mappedArticle = mapArticleToDTO(article);

    return NextResponse.json(mappedArticle);
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}

