import { apiClient } from './client';
import type { StockMovement } from '@/types/stockMovement';
import type { PaginationParams, PaginatedResponse } from '@/types/pagination';

export interface StockMovementFilters extends PaginationParams {
  articleId?: number;
  movementType?: number;
  startDate?: string;
  endDate?: string;
}

export const stockMovementsApi = {
  getAll: async (filters?: StockMovementFilters): Promise<PaginatedResponse<StockMovement>> => {
    const params = new URLSearchParams();
    
    if (filters?.pageNumber) params.append('page', filters.pageNumber.toString());
    if (filters?.pageSize) params.append('limit', filters.pageSize.toString());
    if (filters?.articleId) params.append('articleId', filters.articleId.toString());
    if (filters?.movementType) params.append('movementType', filters.movementType.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const { data } = await apiClient.get<PaginatedResponse<StockMovement>>(
      `/stock-movements?${params.toString()}`
    );
    return data;
  },
};

