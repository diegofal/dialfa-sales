import { NextRequest } from 'next/server';
import { OPERATIONS } from '@/lib/constants/operations';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/services/activityLogger';
import { ChangeTracker } from '@/lib/services/changeTracker';
import { mapCategoryToDTO } from '@/lib/utils/mapper';
import { CreateCategoryInput, UpdateCategoryInput } from '@/lib/validations/schemas';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryListParams {
  page: number;
  limit: number;
  search?: string;
  isActive?: string;
}

export interface PaymentDiscountInput {
  paymentTermId: number;
  discountPercent: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function list(params: CategoryListParams) {
  const { page, limit, search, isActive } = params;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { deleted_at: null };

  if (isActive !== undefined && isActive !== null) {
    where.is_active = isActive === 'true';
  }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [categories, total] = await Promise.all([
    prisma.categories.findMany({
      where,
      include: {
        _count: {
          select: {
            articles: { where: { deleted_at: null, is_active: true } },
          },
        },
      },
      orderBy: { code: 'asc' },
      skip,
      take: limit,
    }),
    prisma.categories.count({ where }),
  ]);

  return {
    data: categories.map((c) => ({
      ...mapCategoryToDTO(c),
      articlesCount: c._count?.articles || 0,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getById(id: bigint) {
  const category = await prisma.categories.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          articles: { where: { deleted_at: null, is_active: true } },
        },
      },
    },
  });

  if (!category || category.deleted_at) {
    return null;
  }

  return {
    ...mapCategoryToDTO(category),
    articlesCount: category._count?.articles || 0,
  };
}

export async function create(data: CreateCategoryInput, request: NextRequest) {
  const category = await prisma.categories.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description,
      default_discount_percent: data.defaultDiscountPercent,
      is_active: data.isActive ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  const tracker = new ChangeTracker();
  tracker.trackCreate('category', category.id, category);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.CATEGORY_CREATE,
    description: `Categoría ${category.name} (${category.code}) creada`,
    entityType: 'category',
    entityId: category.id,
    details: { code: category.code, name: category.name },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return mapCategoryToDTO(category);
}

export async function update(id: bigint, data: UpdateCategoryInput, request: NextRequest) {
  const existingCategory = await prisma.categories.findUnique({ where: { id } });

  if (!existingCategory || existingCategory.deleted_at) {
    return null;
  }

  const tracker = new ChangeTracker();
  await tracker.trackBefore('category', id);

  const category = await prisma.categories.update({
    where: { id },
    data: {
      code: data.code,
      name: data.name,
      description: data.description,
      default_discount_percent: data.defaultDiscountPercent,
      is_active: data.isActive,
      updated_at: new Date(),
    },
  });

  await tracker.trackAfter('category', id);

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.CATEGORY_UPDATE,
    description: `Categoría ${category.name} (${category.code}) actualizada`,
    entityType: 'category',
    entityId: id,
    details: { code: category.code, name: category.name },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return mapCategoryToDTO(category);
}

export async function remove(id: bigint, request: NextRequest) {
  const existingCategory = await prisma.categories.findUnique({ where: { id } });

  if (!existingCategory || existingCategory.deleted_at) {
    return null;
  }

  const tracker = new ChangeTracker();
  tracker.trackDelete('category', id, existingCategory);

  await prisma.categories.update({
    where: { id },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });

  const activityLogId = await logActivity({
    request,
    operation: OPERATIONS.CATEGORY_DELETE,
    description: `Categoría ${existingCategory.name} (${existingCategory.code}) eliminada`,
    entityType: 'category',
    entityId: id,
    details: { code: existingCategory.code, name: existingCategory.name },
  });

  if (activityLogId) {
    await tracker.saveChanges(activityLogId);
  }

  return true;
}

export async function getPaymentDiscounts(categoryId: bigint) {
  const paymentTerms = await prisma.payment_terms.findMany({
    where: { is_active: true },
    include: {
      category_payment_discounts: { where: { category_id: categoryId } },
    },
    orderBy: { days: 'asc' },
  });

  return paymentTerms.map((term) => ({
    paymentTermId: term.id,
    paymentTermCode: term.code,
    paymentTermName: term.name,
    paymentTermDays: term.days,
    discountPercent: term.category_payment_discounts[0]?.discount_percent
      ? Number(term.category_payment_discounts[0].discount_percent)
      : 0,
  }));
}

export async function updatePaymentDiscounts(
  categoryId: bigint,
  discounts: PaymentDiscountInput[],
  request: NextRequest
) {
  const category = await prisma.categories.findUnique({ where: { id: categoryId } });

  if (!category) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.category_payment_discounts.deleteMany({ where: { category_id: categoryId } });

    const discountsToCreate = discounts
      .filter((d) => d.discountPercent > 0)
      .map((d) => ({
        category_id: categoryId,
        payment_term_id: d.paymentTermId,
        discount_percent: d.discountPercent,
        created_at: new Date(),
        updated_at: new Date(),
      }));

    if (discountsToCreate.length > 0) {
      await tx.category_payment_discounts.createMany({ data: discountsToCreate });
    }
  });

  await logActivity({
    request,
    operation: OPERATIONS.CATEGORY_UPDATE,
    description: `Descuentos por condición de pago actualizados para categoría ${category.name}`,
    entityType: 'category',
    entityId: categoryId,
    details: {
      categoryCode: category.code,
      categoryName: category.name,
      discountsCount: discounts.filter((d) => d.discountPercent > 0).length,
    },
  });

  return true;
}
