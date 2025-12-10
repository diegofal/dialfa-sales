import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryNotesApi } from '@/lib/api/deliveryNotes';
import type { DeliveryNote, DeliveryNoteListDto, CreateDeliveryNoteRequest, UpdateDeliveryNoteRequest } from '@/types/deliveryNote';
import { PagedResult, PaginationParams } from '@/types/pagination';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils/errors';

export function useDeliveryNotes(
  params: PaginationParams & {
    salesOrderId?: number;
    fromDate?: string;
    toDate?: string;
  } = {}
) {
  return useQuery<PagedResult<DeliveryNoteListDto>>({
    queryKey: ['delivery-notes', params],
    queryFn: () => deliveryNotesApi.getAll(params),
  });
}

export function useDeliveryNote(id: number) {
  return useQuery<DeliveryNote>({
    queryKey: ['delivery-notes', id],
    queryFn: () => deliveryNotesApi.getById(id),
    enabled: !!id,
    staleTime: 0, // Los datos se consideran obsoletos inmediatamente
    refetchOnMount: 'always', // Siempre refetch al montar para obtener datos frescos
  });
}

export function useCreateDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDeliveryNoteRequest) => deliveryNotesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Remito creado exitosamente');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useUpdateDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDeliveryNoteRequest }) =>
      deliveryNotesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
      toast.success('Remito actualizado exitosamente');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDeleteDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deliveryNotesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast.success('Remito eliminado exitosamente');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export function useDownloadDeliveryNotePdf() {
  return useMutation({
    mutationFn: (id: number) => deliveryNotesApi.downloadPdf(id),
    onSuccess: () => {
      toast.success('Descargando PDF del remito');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}


