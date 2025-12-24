import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapArticleToDTO } from '@/lib/utils/mapper';
import { updateArticleSchema } from '@/lib/validations/schemas';
import { z } from 'zod';
import { OPERATIONS } from '@/lib/constants/operations';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = BigInt(idStr);
    const body = await request.json();

    // Check if article exists and is not deleted
    const existingArticle = await prisma.articles.findUnique({
      where: { id },
    });

    if (!existingArticle || existingArticle.deleted_at) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Validate input
    const validatedData = updateArticleSchema.parse(body);

    // Track before state
    const tracker = new ChangeTracker();
    await tracker.trackBefore('article', id);

    // Convert camelCase to snake_case for Prisma
    const article = await prisma.articles.update({
      where: { id },
      data: {
        code: validatedData.code,
        description: validatedData.description,
        category_id: validatedData.categoryId,
        unit_price: validatedData.unitPrice,
        cost_price: validatedData.costPrice,
        stock: validatedData.stock,
        minimum_stock: validatedData.minimumStock,
        display_order: validatedData.displayOrder,
        is_discontinued: validatedData.isDiscontinued,
        is_active: validatedData.isActive,
        type: validatedData.type,
        series: validatedData.series,
        thickness: validatedData.thickness,
        size: validatedData.size,
        supplier_id: validatedData.supplierId,
        weight_kg: validatedData.weightKg,
        historical_price1: validatedData.historicalPrice1,
        location: validatedData.location,
        notes: validatedData.notes,
        updated_at: new Date(),
      },
      include: {
        categories: true,
      },
    });

    // Map to DTO format
    const mappedArticle = mapArticleToDTO(article);

    // Track after state
    await tracker.trackAfter('article', id);

    // Log activity
    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.ARTICLE_UPDATE,
      description: `Artículo ${article.description} (${article.code}) actualizado`,
      entityType: 'article',
      entityId: id,
      details: { code: article.code, description: article.description }
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

    return NextResponse.json(mappedArticle);
  } catch (error) {
    console.error('Error updating article:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update article' },
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

    // Check if article exists and is not already deleted
    const existingArticle = await prisma.articles.findUnique({
      where: { id },
    });

    if (!existingArticle || existingArticle.deleted_at) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Track deletion
    const tracker = new ChangeTracker();
    tracker.trackDelete('article', id, existingArticle);

    // Soft delete: mark as deleted
    await prisma.articles.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Log activity
    const activityLogId = await logActivity({
      request,
      operation: OPERATIONS.ARTICLE_DELETE,
      description: `Artículo ${existingArticle.description} (${existingArticle.code}) eliminado`,
      entityType: 'article',
      entityId: id,
      details: { code: existingArticle.code, description: existingArticle.description }
    });

    if (activityLogId) {
      await tracker.saveChanges(activityLogId);
    }

    return NextResponse.json(
      { message: 'Article deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json(
      { error: 'Failed to delete article' },
      { status: 500 }
    );
  }
}

