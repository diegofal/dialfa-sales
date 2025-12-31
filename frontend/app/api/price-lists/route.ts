import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/roles';

export async function GET(request: NextRequest) {
  try {
    // Verificar permisos de administrador
    const { authorized, error } = requireAdmin(request);
    if (!authorized) return error;

    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search') || '';
    const activeOnly = searchParams.get('activeOnly') === 'true';

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

    if (activeOnly) {
      where.is_active = true;
    }

    // Fetch all articles with their categories
    const articles = await prisma.articles.findMany({
      where,
      include: {
        categories: true,
      },
      orderBy: [
        { categories: { name: 'asc' } },
        { display_order: 'asc' },
        { code: 'asc' },
      ],
    });

    // Group articles by category
    const categoryMap = new Map<string, {
      categoryId: number;
      categoryName: string;
      categoryCode: string;
      items: Array<{
        id: number;
        code: string;
        description: string;
        unitPrice: number;
        categoryId: number;
        categoryName: string;
        isActive: boolean;
        isDiscontinued: boolean;
      }>;
    }>();

    articles.forEach((article) => {
      const categoryKey = article.category_id.toString();
      
      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          categoryId: Number(article.category_id),
          categoryName: article.categories.name,
          categoryCode: article.categories.code,
          categoryDiscount: Number(article.categories.default_discount_percent),
          items: [],
        });
      }

      const category = categoryMap.get(categoryKey)!;
      category.items.push({
        id: Number(article.id),
        code: article.code,
        description: article.description,
        unitPrice: Number(article.unit_price),
        stock: Number(article.stock),
        costPrice: article.last_purchase_price ? Number(article.last_purchase_price) : undefined,
        cifPercentage: article.cif_percentage ? Number(article.cif_percentage) : undefined,
        categoryId: Number(article.category_id),
        categoryName: article.categories.name,
        categoryDiscount: Number(article.categories.default_discount_percent),
        isActive: article.is_active,
        isDiscontinued: article.is_discontinued,
      });
    });

    // Convert map to array and add totalItems
    const data = Array.from(categoryMap.values()).map(category => ({
      ...category,
      totalItems: category.items.length,
    }));

    return NextResponse.json({
      data,
      totalArticles: articles.length,
      totalCategories: data.length,
    });
  } catch (error) {
    console.error('Error fetching price lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price lists' },
      { status: 500 }
    );
  }
}

