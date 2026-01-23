import type {
  Invoice,
  InvoiceListDto,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
} from '@/types/invoice';
import { PagedResult, PaginationParams } from '@/types/pagination';
import type { StockMovement } from '@/types/stockMovement';
import { apiClient } from './client';

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

  cancel: async (id: number): Promise<void> => {
    await apiClient.post(`/invoices/${id}/cancel`);
  },

  print: async (id: number): Promise<void> => {
    const response = await apiClient.post(
      `/invoices/${id}/print`,
      {},
      {
        responseType: 'blob',
      }
    );

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

  getStockMovements: async (id: number): Promise<StockMovement[]> => {
    const { data } = await apiClient.get<StockMovement[]>(`/invoices/${id}/stock-movements`);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/invoices/${id}`);
  },
};
