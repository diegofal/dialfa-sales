import { useQuery } from '@tanstack/react-query';
import { stockTransitionsApi, TransitionsParams } from '../../api/stockTransitions';

export function useStockTransitions(params: TransitionsParams = {}) {
  return useQuery({
    queryKey: ['stock-transitions', params],
    queryFn: () => stockTransitionsApi.getTransitions(params),
    staleTime: 1000 * 60 * 30,
  });
}
