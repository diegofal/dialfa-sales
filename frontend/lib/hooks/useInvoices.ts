import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '@/lib/api/invoices';
import type { Invoice, InvoiceListDto, CreateInvoiceRequest, UpdateInvoiceRequest, CancelInvoiceRequest } from '@/types/invoice';
import { PagedResult, PaginationParams } from '@/types/pagination';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/errors';

export function useInvoices(
  params: PaginationParams & {
    clientId?: number;
    fromDate?: string;
    toDate?: string;
    isPrinted?: boolean;
    isCancelled?: boolean;
    activeOnly?: boolean;
  } = {}
) {
  return useQuery<PagedResult<InvoiceListDto>>({
    queryKey: ['invoices', params],
    queryFn: () => invoicesApi.getAll(params),
  });
}

export function useInvoice(id: number) {
  return useQuery<Invoice>({
    queryKey: ['invoices', id],
    queryFn: () => invoicesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInvoiceRequest) => invoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Factura creada exitosamente');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateInvoiceRequest }) =>
      invoicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Factura actualizada exitosamente');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CancelInvoiceRequest }) =>
      invoicesApi.cancel(id, data),
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



