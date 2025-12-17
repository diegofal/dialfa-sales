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

  print: async (id: number): Promise<void> => {
    const response = await apiClient.post(`/delivery-notes/${id}/print`, {}, {
      responseType: 'blob',
    });

    // Create blob URL from the PDF
    const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
    const pdfUrl = window.URL.createObjectURL(pdfBlob);

    // Create hidden iframe to load the PDF
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = pdfUrl;
    document.body.appendChild(iframe);

    // Wait for PDF to load, then trigger print dialog
    iframe.onload = () => {
      setTimeout(() => {
        const iframeWindow = iframe.contentWindow;
        if (!iframeWindow) return;

        // Clean up after print dialog is closed
        const cleanup = () => {
          document.body.removeChild(iframe);
          window.URL.revokeObjectURL(pdfUrl);
        };

        // Listen for afterprint event
        iframeWindow.addEventListener('afterprint', cleanup);

        // Fallback cleanup after 30 seconds in case afterprint doesn't fire
        setTimeout(cleanup, 30000);

        // Trigger print dialog
        iframeWindow.print();
      }, 250);
    };
  },
};


