import { Article, ArticleFormData } from '@/types/article';
import { PagedResult, PaginationParams } from '@/types/pagination';
import type { StockStatus } from '@/types/stockValuation';
import apiClient from './client';

export type SoldInPeriod =
  | 'current-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'last-12-months';

export const articlesApi = {
  getAll: async (
    params: PaginationParams & {
      activeOnly?: boolean;
      lowStockOnly?: boolean;
      hasStockOnly?: boolean;
      zeroStockOnly?: boolean;
      categoryId?: number;
      searchTerm?: string;
      includeABC?: boolean;
      includeTrends?: boolean;
      abcFilter?: string;
      salesSort?: string;
      trendMonths?: number;
      soldInPeriod?: SoldInPeriod;
      stockStatusFilter?: StockStatus;
    } = {},
    options: { signal?: AbortSignal } = {}
  ): Promise<PagedResult<Article>> => {
    const apiParams = {
      page: params.pageNumber || 1,
      limit: params.pageSize || 50,
      search: params.searchTerm,
      categoryId: params.categoryId,
      // Only send isActive if activeOnly is explicitly true
      isActive: params.activeOnly === true ? 'true' : undefined,
      includeABC: params.includeABC,
      includeTrends: params.includeTrends,
      abcFilter: params.abcFilter,
      salesSort: params.salesSort,
      sortBy: params.sortBy,
      sortDescending: params.sortDescending,
      trendMonths: params.trendMonths,
      lowStockOnly: params.lowStockOnly,
      hasStockOnly: params.hasStockOnly,
      zeroStockOnly: params.zeroStockOnly,
      soldInPeriod: params.soldInPeriod,
      stockStatus: params.stockStatusFilter,
    };

    const { data } = await apiClient.get<PagedResult<Article>>('/articles', {
      params: apiParams,
      signal: options.signal,
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
