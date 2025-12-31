import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPriceLists, updatePrices } from '@/lib/api/priceList';
import { PriceListFilters, BulkPriceUpdate } from '@/types/priceList';
import { toast } from 'sonner';

export function usePriceLists(filters?: PriceListFilters) {
  return useQuery({
    queryKey: ['price-lists', filters],
    queryFn: () => fetchPriceLists(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdatePrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { updates: BulkPriceUpdate[]; changeType?: 'manual' | 'csv_import' | 'bulk_update'; notes?: string }) => 
      updatePrices(payload),
    onSuccess: (data) => {
      // Invalidar cache de price-lists
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      
      // También invalidar artículos ya que cambiaron los precios
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      
      // Invalidar historial de precios
      queryClient.invalidateQueries({ queryKey: ['price-history'] });
      
      toast.success(`${data.updatedCount} precios actualizados correctamente`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar precios');
    },
  });
}

