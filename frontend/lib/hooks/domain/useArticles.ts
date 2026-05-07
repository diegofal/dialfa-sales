import { Article, ArticleFormData } from '@/types/article';
import { PaginationParams } from '@/types/pagination';
import type { StockStatus } from '@/types/stockValuation';
import { articlesApi, type SoldInPeriod } from '../../api/articles';
import { createCRUDHooks } from '../api';

export type { SoldInPeriod };

export interface ArticlesListParams extends PaginationParams {
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
}

const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  Article,
  ArticleFormData,
  ArticleFormData,
  ArticlesListParams
>({
  entityName: 'Artículo',
  api: articlesApi,
  queryKey: 'articles',
});

export {
  useList as useArticles,
  useById as useArticle,
  useCreate as useCreateArticle,
  useUpdate as useUpdateArticle,
  useDelete as useDeleteArticle,
};
