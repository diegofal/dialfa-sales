import { StockTransitionsResult } from '@/types/stockTransitions';
import { StockStatus } from '@/types/stockValuation';
import apiClient from './client';

export interface TransitionsParams {
  fromDate?: string;
  toDate?: string;
  fromStatus?: StockStatus;
  toStatus?: StockStatus;
  minStockValue?: number;
  limit?: number;
}

export const stockTransitionsApi = {
  getTransitions: async (params: TransitionsParams = {}): Promise<StockTransitionsResult> => {
    const { data } = await apiClient.get<{ data: StockTransitionsResult }>(
      '/articles/status-transitions',
      { params }
    );
    return data.data;
  },
};
