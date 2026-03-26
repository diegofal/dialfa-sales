import { SalesAnalyticsParams, SalesAnalyticsResponse } from '@/types/salesAnalytics';
import apiClient from './client';

export const salesAnalyticsApi = {
  getAnalytics: async (params: SalesAnalyticsParams): Promise<SalesAnalyticsResponse> => {
    const apiParams: Record<string, string | number> = {
      periodMonths: params.periodMonths,
    };

    if (params.startDate) apiParams.startDate = params.startDate;
    if (params.endDate) apiParams.endDate = params.endDate;
    if (params.categoryId) apiParams.categoryId = params.categoryId;

    const { data } = await apiClient.get<SalesAnalyticsResponse>('/articles/sales-analytics', {
      params: apiParams,
    });
    return data;
  },
};
