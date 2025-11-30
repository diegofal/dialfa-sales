import { apiClient } from './client';
import { PagedResult, PaginationParams } from '@/types/pagination';
import type { 
  DeliveryNote, 
  DeliveryNoteListDto, 
  CreateDeliveryNoteRequest, 
  UpdateDeliveryNoteRequest 
} from '@/types/deliveryNote';

export const deliveryNotesApi = {
  getAll: async (params: PaginationParams & {
    salesOrderId?: number;
    fromDate?: string;
    toDate?: string;
  } = {}): Promise<PagedResult<DeliveryNoteListDto>> => {
    const apiParams = {
      page: params.pageNumber || 1,
      limit: params.pageSize || 50,
      salesOrderId: params.salesOrderId,
      fromDate: params.fromDate,
      toDate: params.toDate,
    };
    
    const { data } = await apiClient.get<PagedResult<DeliveryNoteListDto>>('/delivery-notes', {
      params: apiParams,
    });
    
    return data;
  },

  getById: async (id: number): Promise<DeliveryNote> => {
    const { data } = await apiClient.get<DeliveryNote>(`/delivery-notes/${id}`);
    return data;
  },

  create: async (noteData: CreateDeliveryNoteRequest): Promise<DeliveryNote> => {
    const { data } = await apiClient.post<DeliveryNote>('/delivery-notes', noteData);
    return data;
  },

  update: async (id: number, noteData: UpdateDeliveryNoteRequest): Promise<void> => {
    await apiClient.put(`/delivery-notes/${id}`, noteData);
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/delivery-notes/${id}`);
  },

  downloadPdf: async (id: number): Promise<void> => {
    const response = await apiClient.get(`/delivery-notes/${id}/pdf`, {
      responseType: 'blob',
    });

    // Create blob link to download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `remito-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    window.URL.revokeObjectURL(url);
  },
};


