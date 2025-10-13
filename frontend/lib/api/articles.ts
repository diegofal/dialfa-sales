import { Article, ArticleFormData } from '@/types/article';
import apiClient from './client';

export const articlesApi = {
  getAll: async (params?: {
    activeOnly?: boolean;
    lowStockOnly?: boolean;
    categoryId?: number;
    searchTerm?: string;
  }): Promise<Article[]> => {
    const { data } = await apiClient.get<Article[]>('/articles', { params });
    return data;
  },

  getById: async (id: number): Promise<Article> => {
    const { data } = await apiClient.get<Article>(`/articles/${id}`);
    return data;
  },

  create: async (article: ArticleFormData): Promise<Article> => {
    const { data } = await apiClient.post<Article>('/articles', article);
    return data;
  },

  update: async (id: number, article: ArticleFormData): Promise<Article> => {
    const { data } = await apiClient.put<Article>(`/articles/${id}`, {
      ...article,
      id,
    });
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/articles/${id}`);
  },
};




