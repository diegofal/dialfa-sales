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

export function useRevertPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (priceHistoryId: number) => {
      const response = await fetch('/api/price-lists/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceHistoryId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al revertir precio');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidar caches
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['price-history'] });
      
      toast.success('Precio revertido exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al revertir precio');
    },
  });
}

export function useUndoLastChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/price-lists/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al deshacer cambios');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['price-history'] });
      
      toast.success(data.message || 'Cambios deshechos exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al deshacer cambios');
    },
  });
}

export function useRevertBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (changeBatchId: string) => {
      const response = await fetch('/api/price-lists/revert-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeBatchId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al revertir batch');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['price-history'] });
      
      toast.success(data.message || 'Batch revertido exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al revertir batch');
    },
  });
}

