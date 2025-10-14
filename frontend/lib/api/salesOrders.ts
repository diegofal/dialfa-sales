import { apiClient } from './client';
import type { 
  SalesOrder, 
  SalesOrderListDto, 
  CreateSalesOrderRequest, 
  UpdateSalesOrderRequest 
} from '@/types/salesOrder';

export const salesOrdersApi = {
  getAll: async (params?: {
    clientId?: number;
    status?: string;
    fromDate?: string;
    toDate?: string;
    activeOnly?: boolean;
  }): Promise<SalesOrderListDto[]> => {
    const { data } = await apiClient.get<SalesOrderListDto[]>('/sales-orders', {
      params,
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

