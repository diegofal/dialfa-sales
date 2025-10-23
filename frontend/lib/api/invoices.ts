import { apiClient } from './client';
import { PagedResult, PaginationParams } from '@/types/pagination';
import type {
  Invoice,
  InvoiceListDto,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  CancelInvoiceRequest,
} from '@/types/invoice';

export const invoicesApi = {
  getAll: async (
    params: PaginationParams & {
      clientId?: number;
      fromDate?: string;
      toDate?: string;
      isPrinted?: boolean;
      isCancelled?: boolean;
      activeOnly?: boolean;
    } = {}
  ): Promise<PagedResult<InvoiceListDto>> => {
    const apiParams = {
      page: params.pageNumber || 1,
      limit: params.pageSize || 50,
      isCancelled: params.isCancelled,
    };
    
    const { data } = await apiClient.get<PagedResult<InvoiceListDto>>('/invoices', {
      params: apiParams,
    });
    
    return data;
  },

  getById: async (id: number): Promise<Invoice> => {
    const { data } = await apiClient.get<Invoice>(`/invoices/${id}`);
    return data;
  },

  create: async (invoiceData: CreateInvoiceRequest): Promise<{ id: number }> => {
    const { data } = await apiClient.post<{ id: number }>('/invoices', invoiceData);
    return data;
  },

  update: async (id: number, invoiceData: UpdateInvoiceRequest): Promise<void> => {
    await apiClient.put(`/invoices/${id}`, invoiceData);
  },

  cancel: async (id: number, cancelData: CancelInvoiceRequest): Promise<void> => {
    await apiClient.post(`/invoices/${id}/cancel`, cancelData);
  },

  print: async (id: number): Promise<void> => {
    await apiClient.post(`/invoices/${id}/print`);
  },

  downloadPdf: async (id: number): Promise<void> => {
    const response = await apiClient.get(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    
    // Create blob link to download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `factura-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  getNextNumber: async (): Promise<{ invoiceNumber: string }> => {
    const { data } = await apiClient.get<{ invoiceNumber: string }>('/invoices/next-number');
    return data;
  },
};

