import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapArticleToDTO } from '@/lib/utils/mapper';
import { createArticleSchema } from '@/lib/validations/schemas';
import { z } from 'zod';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = createArticleSchema.parse(body);

    // Convert camelCase to snake_case for Prisma
    const article = await prisma.articles.create({
      data: {
        code: validatedData.code,
        description: validatedData.description,
        category_id: validatedData.categoryId,
        unit_price: validatedData.unitPrice,
        cost_price: validatedData.costPrice,
        stock: validatedData.stock ?? 0,
        minimum_stock: validatedData.minimumStock ?? 0,
        display_order: validatedData.displayOrder,
        is_discontinued: validatedData.isDiscontinued ?? false,
        is_active: validatedData.isActive ?? true,
        type: validatedData.type,
        series: validatedData.series,
        thickness: validatedData.thickness,
        size: validatedData.size,
        supplier_id: validatedData.supplierId,
        weight_kg: validatedData.weightKg,
        historical_price1: validatedData.historicalPrice1,
        location: validatedData.location,
        notes: validatedData.notes,
        created_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        categories: true,
      },
    });

    // Map to DTO format
    const mappedArticle = mapArticleToDTO(article);

    return NextResponse.json(mappedArticle, { status: 201 });
  } catch (error) {
    console.error('Error creating article:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create article' },
      { status: 500 }
    );
  }
}

