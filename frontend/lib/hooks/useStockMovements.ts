import { useQuery } from '@tanstack/react-query';
import { stockMovementsApi, type StockMovementFilters } from '@/lib/api/stockMovements';

export function useStockMovements(filters?: StockMovementFilters) {
  return useQuery({
    queryKey: ['stock-movements', filters],
    queryFn: () => stockMovementsApi.getAll(filters),
    staleTime: 30000, // 30 seconds
  });
}

