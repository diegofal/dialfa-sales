import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { StockCategorySnapshotsByStatus } from '@/types/stockSnapshot';
import { StockClassificationConfig } from '@/types/stockValuation';
import apiClient from '../../api/client';
import { stockValuationApi, ValuationParams } from '../../api/stockValuation';

export function useStockValuation(params: ValuationParams = {}) {
  return useQuery({
    queryKey: ['stock-valuation', params],
    queryFn: () => stockValuationApi.getValuation(params),
    staleTime: 1000 * 60 * 60, // 1 hora - los datos son relativamente estables
  });
}

export function useStockCategorySnapshots(months = 6) {
  return useQuery({
    queryKey: ['stock-category-snapshots', months],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: StockCategorySnapshotsByStatus }>(
        '/stock-snapshots',
        { params: { type: 'category', months } }
      );
      return data.data;
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function useRefreshStockValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config?: Partial<StockClassificationConfig>) =>
      stockValuationApi.refreshValuation(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-valuation'] });
      toast.success('Valorización recalculada exitosamente');
    },
    onError: (error: unknown) => {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Error al recalcular la valorización';
      toast.error(errorMessage);
    },
  });
}
