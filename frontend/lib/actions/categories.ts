'use server';

import { getErrorMessage } from '@/lib/utils/errors';

import { prisma } from '@/lib/db';
import { createCategorySchema, updateCategorySchema, type CreateCategoryInput, type UpdateCategoryInput } from '@/lib/validations/schemas';
import { revalidatePath } from 'next/cache';

export async function createCategory(data: CreateCategoryInput) {
  try {
    const validated = createCategorySchema.parse(data);

    // Check if code already exists
    const existing = await prisma.categories.findFirst({
      where: {
        code: validated.code,
        deleted_at: null,
      },
    });

    if (existing) {
      return {
        success: false,
        error: 'Ya existe una categoría con este código',
      };
    }

    const category = await prisma.categories.create({
      data: {
        code: validated.code,
        name: validated.name,
        description: validated.description,
        default_discount_percent: validated.defaultDiscountPercent,
        is_active: validated.isActive,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/categories');

    return {
      success: true,
      data: {
        ...category,
        id: category.id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error creating category:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to create category',
    };
  }
}

export async function updateCategory(id: string, data: UpdateCategoryInput) {
  try {
    const categoryId = BigInt(id);
    const validated = updateCategorySchema.parse(data);

    const existing = await prisma.categories.findUnique({
      where: { id: categoryId },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Categoría no encontrada',
      };
    }

    if (validated.code && validated.code !== existing.code) {
      const codeExists = await prisma.categories.findFirst({
        where: {
          code: validated.code,
          deleted_at: null,
          id: { not: categoryId },
        },
      });

      if (codeExists) {
        return {
          success: false,
          error: 'Ya existe una categoría con este código',
        };
      }
    }

    const category = await prisma.categories.update({
      where: { id: categoryId },
      data: {
        ...validated,
        default_discount_percent: validated.defaultDiscountPercent,
        is_active: validated.isActive,
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/categories');
    revalidatePath(`/dashboard/categories/${id}`);

    return {
      success: true,
      data: {
        ...category,
        id: category.id.toString(),
      },
    };
  } catch (error: unknown) {
    console.error('Error updating category:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to update category',
    };
  }
}

export async function deleteCategory(id: string) {
  try {
    const categoryId = BigInt(id);

    const existing = await prisma.categories.findUnique({
      where: { id: categoryId },
      include: {
        articles: {
          where: { deleted_at: null },
          take: 1,
        },
      },
    });

    if (!existing || existing.deleted_at) {
      return {
        success: false,
        error: 'Categoría no encontrada',
      };
    }

    if (existing.articles.length > 0) {
      return {
        success: false,
        error: 'No se puede eliminar una categoría que tiene artículos asociados',
      };
    }

    await prisma.categories.update({
      where: { id: categoryId },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/categories');

    return {
      success: true,
      message: 'Categoría eliminada correctamente',
    };
  } catch (error: unknown) {
    console.error('Error deleting category:', error);
    return {
      success: false,
      error: getErrorMessage(error) || 'Failed to delete category',
    };
  }
}


