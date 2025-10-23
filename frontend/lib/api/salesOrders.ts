import { apiClient } from './client';
import { PagedResult, PaginationParams } from '@/types/pagination';
import type { 
  SalesOrder, 
  SalesOrderListDto, 
  CreateSalesOrderRequest, 
  UpdateSalesOrderRequest 
} from '@/types/salesOrder';

export const salesOrdersApi = {
  getAll: async (params: PaginationParams & {
    clientId?: number;
    status?: string;
    fromDate?: string;
    toDate?: string;
    activeOnly?: boolean;
  } = {}): Promise<PagedResult<SalesOrderListDto>> => {
    const apiParams = {
      page: params.pageNumber || 1,
      limit: params.pageSize || 50,
      clientId: params.clientId,
      status: params.status,
    };
    
    const { data } = await apiClient.get<PagedResult<SalesOrderListDto>>('/sales-orders', {
      params: apiParams,
    });
    
    return data;
  },

  getById: async (id: number): Promise<SalesOrder> => {
    const { data } = await apiClient.get<SalesOrder>(`/sales-orders/${id}`);
    return data;
  },

  create: async (orderData: CreateSalesOrderRequest): Promise<{ id: number }> => {
    const { data } = await apiClient.post<{ id: number }>('/sales-orders', orderData);
    return data;
  },

  update: async (id: number, orderData: UpdateSalesOrderRequest): Promise<void> => {
    await apiClient.put(`/sales-orders/${id}`, orderData);
  },

  cancel: async (id: number): Promise<void> => {
    await apiClient.post(`/sales-orders/${id}/cancel`);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/sales-orders/${id}`);
  },
};


