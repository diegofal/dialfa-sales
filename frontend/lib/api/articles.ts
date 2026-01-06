import { Article, ArticleFormData } from '@/types/article';
import { PagedResult, PaginationParams } from '@/types/pagination';
import apiClient from './client';

export const articlesApi = {
  getAll: async (params: PaginationParams & {
    activeOnly?: boolean;
    lowStockOnly?: boolean;
    hasStockOnly?: boolean;
    zeroStockOnly?: boolean;
    categoryId?: number;
    searchTerm?: string;
    includeABC?: boolean;
    abcFilter?: string;
    salesSort?: string;
    trendMonths?: number;
  } = {}): Promise<PagedResult<Article>> => {
    const apiParams = {
      page: params.pageNumber || 1,
      limit: params.pageSize || 50,
      search: params.searchTerm,
      categoryId: params.categoryId,
      // Only send isActive if activeOnly is explicitly true
      isActive: params.activeOnly === true ? 'true' : undefined,
      includeABC: params.includeABC,
      abcFilter: params.abcFilter,
      salesSort: params.salesSort,
      trendMonths: params.trendMonths,
      lowStockOnly: params.lowStockOnly,
      hasStockOnly: params.hasStockOnly,
      zeroStockOnly: params.zeroStockOnly,
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
