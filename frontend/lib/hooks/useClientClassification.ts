import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { ClientClassificationSummary, ClientClassificationConfig } from '@/types/clientClassification';

export const useClientClassification = (config: Partial<ClientClassificationConfig> = {}) => {
  return useQuery({
    queryKey: ['clientClassification', config],
    queryFn: async (): Promise<ClientClassificationSummary> => {
      const { data } = await apiClient.get('/clients/classification', {
        params: {
          activeThreshold: config.activeThresholdDays,
          slowThreshold: config.slowMovingThresholdDays,
          inactiveThreshold: config.inactiveThresholdDays,
          minPurchasesPerMonth: config.minPurchasesPerMonth,
          trendMonths: config.trendMonths,
        },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

