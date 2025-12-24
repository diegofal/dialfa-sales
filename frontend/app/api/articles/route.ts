import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapArticleToDTO } from '@/lib/utils/mapper';
import { createArticleSchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';
import { getUserFromRequest } from '@/lib/auth/roles';

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

    // If searching, try to find exact match first
    let exactMatch = null;
    if (search) {
      exactMatch = await prisma.articles.findFirst({
        where: {
          ...where,
          code: { equals: search, mode: 'insensitive' },
        },
        include: {
          categories: true,
        },
      });
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
    let mappedArticles = articles.map(mapArticleToDTO);

    // If there's an exact match, ensure it's first and not duplicated
    if (exactMatch) {
      const exactMatchDTO = mapArticleToDTO(exactMatch);
      // Remove exact match if it's already in the results
      mappedArticles = mappedArticles.filter(a => a.id !== exactMatchDTO.id);
      // Add it at the beginning
      mappedArticles.unshift(exactMatchDTO);
      // Trim to limit
      if (mappedArticles.length > limit) {
        mappedArticles = mappedArticles.slice(0, limit);
      }
    }

    // If search term provided, sort remaining items by relevance
    if (search && mappedArticles.length > 1) {
      const searchUpper = search.toUpperCase();
      const first = mappedArticles[0]; // Keep first item (exact match) in place
      const rest = mappedArticles.slice(1);
      
      rest.sort((a, b) => {
        const aCode = a.code.toUpperCase();
        const bCode = b.code.toUpperCase();

        // Starts with priority
        const aStarts = aCode.startsWith(searchUpper);
        const bStarts = bCode.startsWith(searchUpper);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // Fall back to display order and alphabetical
        const aOrder = a.displayOrder ?? 999999;
        const bOrder = b.displayOrder ?? 999999;
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        return aCode.localeCompare(bCode);
      });

      mappedArticles = [first, ...rest];
    }

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

    // Verificar permisos: solo admin puede crear artículos
    const user = getUserFromRequest(request);
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Solo los administradores pueden crear artículos' },
        { status: 403 }
      );
    }

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

    // Track creation
    const tracker = new ChangeTracker();
    tracker.trackCreate('article', article.id, article);

    // Log activity
    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.ARTICLE_CREATE,
      description: `Artículo ${article.description} (${article.code}) creado`,
      entityType: 'article',
      entityId: article.id,
      details: { code: article.code, description: article.description }
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

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

