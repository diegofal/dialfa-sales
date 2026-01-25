import { Article, ArticleFormData } from '@/types/article';
import { PaginationParams } from '@/types/pagination';
import { articlesApi } from '../../api/articles';
import { createCRUDHooks } from '../api';

export interface ArticlesListParams extends PaginationParams {
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
