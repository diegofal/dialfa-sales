import { Category, CategoryFormData } from '@/types/category';
import apiClient from './client';

export const categoriesApi = {
  getAll: async (activeOnly: boolean = false): Promise<Category[]> => {
    const { data } = await apiClient.get<Category[]>('/categories', {
      params: { activeOnly },
    });
    return data;
  },

  getById: async (id: number): Promise<Category> => {
    const { data } = await apiClient.get<Category>(`/categories/${id}`);
    return data;
  },

  create: async (category: CategoryFormData): Promise<Category> => {
    const { data } = await apiClient.post<Category>('/categories', category);
    return data;
  },

  update: async (id: number, category: CategoryFormData): Promise<Category> => {
    const { data } = await apiClient.put<Category>(`/categories/${id}`, {
      ...category,
      id,
    });
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/categories/${id}`);
  },
};

