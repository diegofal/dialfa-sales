import type {
  SupplierOrderFormData,
  SupplierOrderStatus,
  SupplierOrder,
} from '@/types/supplierOrder';
import { apiClient } from './client';

interface SupplierOrdersResponse {
  success: boolean;
  data: SupplierOrder[];
}

export const supplierOrdersApi = {
  getAll: async (params?: {
    status?: SupplierOrderStatus;
    supplierId?: number;
  }): Promise<SupplierOrdersResponse> => {
    const { data } = await apiClient.get<SupplierOrdersResponse>('/supplier-orders', { params });
    return data;
  },

  getById: async (id: number): Promise<SupplierOrder> => {
    const { data } = await apiClient.get<SupplierOrder>(`/supplier-orders/${id}`);
    return data;
  },

  create: async (order: SupplierOrderFormData): Promise<SupplierOrder> => {
    const { data } = await apiClient.post<SupplierOrder>('/supplier-orders', order);
    return data;
  },

  update: async (id: number, order: Partial<SupplierOrderFormData>): Promise<SupplierOrder> => {
    const { data } = await apiClient.put<SupplierOrder>(`/supplier-orders/${id}`, order);
    return data;
  },

  updateStatus: async (id: number, status: SupplierOrderStatus): Promise<SupplierOrder> => {
    const { data } = await apiClient.patch<SupplierOrder>(`/supplier-orders/${id}/status`, {
      status,
    });
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/supplier-orders/${id}`);
  },
};
