import { Article, ArticleFormData } from '@/types/article';
import { PagedResult, PaginationParams } from '@/types/pagination';
import apiClient from './client';

export const articlesApi = {
  getAll: async (params: PaginationParams & {
    activeOnly?: boolean;
    lowStockOnly?: boolean;
    categoryId?: number;
    searchTerm?: string;
  } = {}): Promise<PagedResult<Article>> => {
    const apiParams = {
      page: params.pageNumber || 1,
      limit: params.pageSize || 50,
      search: params.searchTerm,
      categoryId: params.categoryId,
      isActive: params.activeOnly,
    };
    
    const { data } = await apiClient.get<PagedResult<Article>>('/articles', { 
      params: apiParams 
    });
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
