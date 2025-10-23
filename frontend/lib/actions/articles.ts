'use server';

import { prisma } from '@/lib/db';
import { createArticleSchema, updateArticleSchema, type CreateArticleInput, type UpdateArticleInput } from '@/lib/validations/schemas';
import { revalidatePath } from 'next/cache';
import { getErrorMessage } from '@/lib/utils/errors';

export async function createArticle(data: CreateArticleInput) {
  try {
    // Validate input
    const validated = createArticleSchema.parse(data);

    // Check if code already exists
    const existing = await prisma.articles.findFirst({
      where: {
        code: validated.code,
        deleted_at: null,
      },
    });

    if (existing) {
      return {
        success: false,
        error: 'Ya existe un artículo con este código',
      };
    }

    // Create article
    const article = await prisma.articles.create({
      data: {
        code: validated.code,
        description: validated.description,
        category_id: validated.categoryId,
        unit_price: validated.unitPrice,
        cost_price: validated.costPrice,
        stock: validated.stock,
        minimum_stock: validated.minimumStock,
        display_order: validated.displayOrder,
        is_discontinued: validated.isDiscontinued,
        is_active: validated.isActive,
        type: validated.type,
        series: validated.series,
        thickness: validated.thickness,
        size: validated.size,
        supplier_id: validated.supplierId,
        weight_kg: validated.weightKg,
        historical_price1: validated.historicalPrice1,
        location: validated.location,
        notes: validated.notes,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/articles');

    return {
      success: true,
      data: {
        ...article,
        id: article.id.toString(),
        category_id: article.category_id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error creating article:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to create article',
    };
  }
}

export async function updateArticle(id: string, data: UpdateArticleInput) {
  try {
    const articleId = BigInt(id);

    // Validate input
    const validated = updateArticleSchema.parse(data);

    // Check if article exists
    const existing = await prisma.articles.findUnique({
      where: { id: articleId },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Artículo no encontrado',
      };
    }

    // Check if code is being changed and already exists
    if (validated.code && validated.code !== existing.code) {
      const codeExists = await prisma.articles.findFirst({
        where: {
          code: validated.code,
          deleted_at: null,
          id: { not: articleId },
        },
      });

      if (codeExists) {
        return {
          success: false,
          error: 'Ya existe un artículo con este código',
        };
      }
    }

    // Update article
    const article = await prisma.articles.update({
      where: { id: articleId },
      data: {
        ...validated,
        category_id: validated.categoryId,
        unit_price: validated.unitPrice,
        cost_price: validated.costPrice,
        minimum_stock: validated.minimumStock,
        display_order: validated.displayOrder,
        is_discontinued: validated.isDiscontinued,
        is_active: validated.isActive,
        supplier_id: validated.supplierId,
        weight_kg: validated.weightKg,
        historical_price1: validated.historicalPrice1,
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/articles');
    revalidatePath(`/dashboard/articles/${id}`);

    return {
      success: true,
      data: {
        ...article,
        id: article.id.toString(),
        category_id: article.category_id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error updating article:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to update article',
    };
  }
}

export async function deleteArticle(id: string) {
  try {
    const articleId = BigInt(id);

    // Check if article exists
    const existing = await prisma.articles.findUnique({
      where: { id: articleId },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Artículo no encontrado',
      };
    }

    // Soft delete
    await prisma.articles.update({
      where: { id: articleId },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/articles');

    return {
      success: true,
      message: 'Artículo eliminado correctamente',
    };
  } catch (error: unknown) {
    console.error('Error deleting article:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to delete article',
    };
  }
}

