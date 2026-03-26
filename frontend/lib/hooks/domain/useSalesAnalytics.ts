import { useQuery } from '@tanstack/react-query';
import { SalesAnalyticsParams } from '@/types/salesAnalytics';
import { salesAnalyticsApi } from '../../api/salesAnalytics';

export function useSalesAnalytics(params: SalesAnalyticsParams) {
  const isCustomRange = params.periodMonths === 0;
  const hasValidCustomRange = isCustomRange && !!params.startDate && !!params.endDate;
  const hasValidPreset = !isCustomRange && params.periodMonths > 0;

  return useQuery({
    queryKey: ['sales-analytics', params],
    queryFn: () => salesAnalyticsApi.getAnalytics(params),
    staleTime: 1000 * 60 * 10, // 10 minutos
    enabled: hasValidPreset || hasValidCustomRange,
  });
}
