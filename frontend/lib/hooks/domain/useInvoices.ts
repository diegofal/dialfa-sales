import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { invoicesApi } from '@/lib/api/invoices';
import { getErrorMessage } from '@/lib/utils/errors';
import type {
  Invoice,
  InvoiceListDto,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
} from '@/types/invoice';
import { PaginationParams } from '@/types/pagination';
import type { StockMovement } from '@/types/stockMovement';
import { createCRUDHooks } from '../api/createCRUDHooks';

type InvoiceListParams = PaginationParams & {
  clientId?: number;
  fromDate?: string;
  toDate?: string;
  isPrinted?: boolean;
  isCancelled?: boolean;
  activeOnly?: boolean;
};

// Generate CRUD hooks using factory pattern
const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  Invoice,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  InvoiceListParams
>({
  entityName: 'Factura',
  api: invoicesApi,
  queryKey: 'invoices',
});

// Export CRUD hooks with semantic names
export {
  useList as useInvoices,
  useById as useInvoice,
  useCreate as useCreateInvoice,
  useUpdate as useUpdateInvoice,
  useDelete as useDeleteInvoice,
};

// Domain-specific hooks (non-CRUD operations)

export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: number }) => invoicesApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Factura cancelada exitosamente');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function usePrintInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => invoicesApi.print(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Factura marcada como impresa');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: (id: number) => invoicesApi.downloadPdf(id),
    onSuccess: () => {
      toast.success('Descargando PDF de la factura');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useNextInvoiceNumber() {
  return useQuery<{ invoiceNumber: string }>({
    queryKey: ['invoices', 'next-number'],
    queryFn: () => invoicesApi.getNextNumber(),
  });
}

export function useUpdateInvoiceExchangeRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, usdExchangeRate }: { id: number; usdExchangeRate: number }) =>
      fetch(`/api/invoices/${id}/exchange-rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usdExchangeRate }),
      }).then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to update exchange rate');
        }
        return res.json();
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Tipo de cambio actualizado. Los precios han sido recalculados.');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useInvoiceStockMovements(invoiceId: number) {
  return useQuery<StockMovement[]>({
    queryKey: ['invoices', invoiceId, 'stock-movements'],
    queryFn: () => invoicesApi.getStockMovements(invoiceId),
    enabled: !!invoiceId,
  });
}

export function useUpdateInvoiceItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      items,
    }: {
      id: number;
      items: Array<{ id: number; discountPercent: number }>;
    }) =>
      fetch(`/api/invoices/${id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Error al actualizar descuentos');
        }
        return res.json();
      }),
    onSuccess: (_data, variables) => {
      // Invalidar las queries para forzar refetch
      queryClient.invalidateQueries({ queryKey: ['invoices', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Descuentos actualizados correctamente');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
