import type { DeliveryNote } from '@/types/deliveryNote';
import type { Invoice } from '@/types/invoice';
import { PagedResult, PaginationParams } from '@/types/pagination';
import type { SalesOrderStatus, SalesOrderPermissions } from '@/types/permissions';
import type {
  SalesOrder,
  SalesOrderListDto,
  CreateSalesOrderRequest,
  UpdateSalesOrderRequest,
  SalesOrderUpdateResponse,
} from '@/types/salesOrder';
import { apiClient } from './client';

export const salesOrdersApi = {
  getAll: async (
    params: PaginationParams & {
      clientId?: number;
      status?: string;
      fromDate?: string;
      toDate?: string;
      activeOnly?: boolean;
    } = {}
  ): Promise<PagedResult<SalesOrderListDto>> => {
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

  update: async (
    id: number,
    orderData: UpdateSalesOrderRequest
  ): Promise<SalesOrderUpdateResponse> => {
    const { data } = await apiClient.put<SalesOrderUpdateResponse>(
      `/sales-orders/${id}`,
      orderData
    );
    return data;
  },

  cancel: async (id: number): Promise<void> => {
    await apiClient.post(`/sales-orders/${id}/cancel`);
  },

  delete: async (
    id: number
  ): Promise<{
    message: string;
    affectedInvoices?: Array<{ id: string; invoiceNumber: string; wasCancelled: boolean }>;
    affectedDeliveryNotes?: string[];
    orderNumber?: string;
  }> => {
    const { data } = await apiClient.delete(`/sales-orders/${id}`);
    return data;
  },

  getPermissions: async (
    id: number
  ): Promise<{
    status: SalesOrderStatus;
    permissions: SalesOrderPermissions;
  }> => {
    const { data } = await apiClient.get(`/sales-orders/${id}/permissions`);
    return data;
  },

  generateInvoice: async (id: number, usdExchangeRate?: number): Promise<Invoice> => {
    const { data } = await apiClient.post<Invoice>(`/sales-orders/${id}/generate-invoice`, {
      usdExchangeRate,
    });
    return data;
  },

  generateDeliveryNote: async (
    id: number,
    deliveryData?: {
      deliveryDate?: string;
      transporterId?: number;
      weightKg?: number;
      packagesCount?: number;
      declaredValue?: number;
      notes?: string;
    }
  ): Promise<DeliveryNote> => {
    const { data } = await apiClient.post<DeliveryNote>(
      `/sales-orders/${id}/generate-delivery-note`,
      deliveryData
    );
    return data;
  },
};
