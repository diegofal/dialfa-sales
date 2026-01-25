import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deliveryNotesApi } from '@/lib/api/deliveryNotes';
import { getErrorMessage } from '@/lib/utils/errors';
import type {
  DeliveryNote,
  CreateDeliveryNoteRequest,
  UpdateDeliveryNoteRequest,
} from '@/types/deliveryNote';
import { PaginationParams } from '@/types/pagination';
import { createCRUDHooks } from '../api/createCRUDHooks';

type DeliveryNoteListParams = PaginationParams & {
  salesOrderId?: number;
  fromDate?: string;
  toDate?: string;
};

// Generate CRUD hooks using factory pattern
// Note: The API returns DeliveryNoteListDto for getAll, but we use DeliveryNote as the type parameter
// This is a known limitation of the CRUD factory pattern that should be addressed in the future
const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  DeliveryNote,
  CreateDeliveryNoteRequest,
  UpdateDeliveryNoteRequest,
  DeliveryNoteListParams
>({
  entityName: 'Remito',
  api: deliveryNotesApi as any, // Type assertion needed due to DTO mismatch
  queryKey: 'delivery-notes',
});

// Export CRUD hooks with semantic names
export {
  useList as useDeliveryNotes,
  useById as useDeliveryNote,
  useCreate as useCreateDeliveryNote,
  useUpdate as useUpdateDeliveryNote,
  useDelete as useDeleteDeliveryNote,
};

// Domain-specific hooks (non-CRUD operations)

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

export function usePrintDeliveryNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deliveryNotesApi.print(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
      toast.success('Remito marcado como impreso');
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });
}
