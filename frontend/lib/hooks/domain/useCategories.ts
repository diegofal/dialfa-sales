import type { Category, CategoryFormData } from '@/types/category';
import type { PaginationParams } from '@/types/pagination';
import { categoriesApi } from '../../api/categories';
import { createCRUDHooks } from '../api/createCRUDHooks';

// Query key factory
export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (params: PaginationParams & { activeOnly?: boolean }) =>
    [...categoryKeys.lists(), params] as const,
  details: () => [...categoryKeys.all, 'detail'] as const,
  detail: (id: number) => [...categoryKeys.details(), id] as const,
};

type CategoryListParams = PaginationParams & { activeOnly?: boolean };

// Generate CRUD hooks using factory pattern
const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  Category,
  CategoryFormData,
  CategoryFormData,
  CategoryListParams
>({
  entityName: 'Categoría',
  api: categoriesApi,
  queryKey: 'categories',
});

// Export hooks with semantic names
export {
  useList as useCategories,
  useById as useCategory,
  useCreate as useCreateCategory,
  useUpdate as useUpdateCategory,
  useDelete as useDeleteCategory,
};
