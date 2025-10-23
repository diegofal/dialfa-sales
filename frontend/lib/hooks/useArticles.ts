import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { articlesApi } from '../api/articles';
import { ArticleFormData } from '@/types/article';
import { PaginationParams } from '@/types/pagination';
import { toast } from 'sonner';

export function useArticles(params: PaginationParams & {
  activeOnly?: boolean;
  lowStockOnly?: boolean;
  categoryId?: number;
  searchTerm?: string;
} = {}) {
  return useQuery({
    queryKey: ['articles', params],
    queryFn: () => articlesApi.getAll(params),
  });
}

export function useArticle(id: number) {
  return useQuery({
    queryKey: ['articles', id],
    queryFn: () => articlesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (article: ArticleFormData) => articlesApi.create(article),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast.success('Artículo creado exitosamente');
    },
    onError: (error: unknown) => {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Error al crear el artículo';
      toast.error(errorMessage);
    },
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, article }: { id: number; article: ArticleFormData }) =>
      articlesApi.update(id, article),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast.success('Artículo actualizado exitosamente');
    },
    onError: (error: unknown) => {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Error al actualizar el artículo';
      toast.error(errorMessage);
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => articlesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast.success('Artículo eliminado exitosamente');
    },
    onError: (error: unknown) => {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Error al eliminar el artículo';
      toast.error(errorMessage);
    },
  });
}


