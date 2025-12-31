import { useQuery } from '@tanstack/react-query';
import { fetchPriceHistory } from '@/lib/api/priceHistory';
import { PriceHistoryFilters } from '@/types/priceHistory';

export function usePriceHistory(filters?: PriceHistoryFilters) {
  return useQuery({
    queryKey: ['price-history', filters],
    queryFn: () => fetchPriceHistory(filters),
    staleTime: 30 * 1000, // 30 segundos
  });
}

