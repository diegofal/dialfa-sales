import { apiClient } from './client';
import type { Category, CategoryFormData } from '@/types/category';

export const categoriesApi = {
  getAll: async (activeOnly: boolean = false): Promise<Category[]> => {
    const { data } = await apiClient.get<Category[]>('/categories', {
      params: { activeOnly },
    });
    return data;
  },

  getById: async (id: number): Promise<Category> => {
    const { data} = await apiClient.get<Category>(`/categories/${id}`);
    return data;
  },

  create: async (categoryData: CategoryFormData): Promise<Category> => {
    const { data } = await apiClient.post<Category>('/categories', categoryData);
    return data;
  },

  update: async (id: number, categoryData: CategoryFormData): Promise<Category> => {
    const { data } = await apiClient.put<Category>(`/categories/${id}`, {
      id,
      ...categoryData,
    });
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/categories/${id}`);
  },
};





