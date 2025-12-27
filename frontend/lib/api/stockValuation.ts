import {
  StockValuationSummary,
  StockClassificationConfig,
  StockStatus,
} from '@/types/stockValuation';
import apiClient from './client';

export interface ValuationParams extends Partial<StockClassificationConfig> {
  status?: StockStatus;
  refresh?: boolean;
}

export const stockValuationApi = {
  getValuation: async (params: ValuationParams = {}): Promise<StockValuationSummary> => {
    const apiParams = {
      activeThreshold: params.activeThresholdDays,
      slowThreshold: params.slowMovingThresholdDays,
      deadThreshold: params.deadStockThresholdDays,
      minSales: params.minSalesForActive,
      trendMonths: params.trendMonths,
      status: params.status,
      refresh: params.refresh,
    };

    const { data } = await apiClient.get<StockValuationSummary>(
      '/articles/valuation',
      { params: apiParams }
    );
    return data;
  },

  refreshValuation: async (config?: Partial<StockClassificationConfig>): Promise<StockValuationSummary> => {
    const { data } = await apiClient.post<{ valuation: StockValuationSummary }>(
      '/articles/valuation',
      { config }
    );
    return data.valuation;
  },
};

