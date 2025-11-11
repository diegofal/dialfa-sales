import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesOrdersApi } from '../api/salesOrders';
import { PaginationParams } from '@/types/pagination';
import type { CreateSalesOrderRequest, UpdateSalesOrderRequest } from '@/types/salesOrder';
import type { Invoice } from '@/types/invoice';
import type { DeliveryNote } from '@/types/deliveryNote';
import { toast } from 'sonner';
import { useQuickInvoiceTabs } from './useQuickInvoiceTabs';
import { useQuickDeliveryNoteTabs } from './useQuickDeliveryNoteTabs';

export const useSalesOrders = (params: PaginationParams & {
  clientId?: number;
  status?: string;
  fromDate?: string;
  toDate?: string;
  activeOnly?: boolean;
} = {}) => {
  return useQuery({
    queryKey: ['salesOrders', params],
    queryFn: () => salesOrdersApi.getAll(params),
  });
};

export const useSalesOrder = (id: number) => {
  return useQuery({
    queryKey: ['salesOrders', id],
    queryFn: () => salesOrdersApi.getById(id),
    enabled: !!id,
    retry: (failureCount, error) => {
      // Don't retry on 404 (deleted order)
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });
};

export const useCreateSalesOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSalesOrderRequest) => salesOrdersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      toast.success('Pedido creado exitosamente');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Error al crear el pedido');
    },
  });
};

export const useUpdateSalesOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSalesOrderRequest }) =>
      salesOrdersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      toast.success('Pedido actualizado exitosamente');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Error al actualizar el pedido');
    },
  });
};

export const useCancelSalesOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => salesOrdersApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      toast.success('Pedido cancelado exitosamente');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Error al cancelar el pedido');
    },
  });
};

export const useDeleteSalesOrder = () => {
  const queryClient = useQueryClient();
  const { removeTabByInvoiceId } = useQuickInvoiceTabs();
  const { removeTabByDeliveryNoteId } = useQuickDeliveryNoteTabs();

  return useMutation({
    mutationFn: (id: number) => salesOrdersApi.delete(id),
    onSuccess: (data) => {
      // Remove tabs from sidebar for affected invoices and delivery notes
      if (data.affectedInvoices && data.affectedInvoices.length > 0) {
        data.affectedInvoices.forEach(invoice => {
          removeTabByInvoiceId(parseInt(invoice.id));
        });
      }
      
      if (data.affectedDeliveryNotes && data.affectedDeliveryNotes.length > 0) {
        data.affectedDeliveryNotes.forEach(deliveryNoteId => {
          removeTabByDeliveryNoteId(parseInt(deliveryNoteId));
        });
      }
      
      // Invalidate sales orders queries
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      // Invalidate invoices and delivery notes queries since they may have been deleted/cancelled
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
      
      // Build detailed success message
      let message = `Pedido ${data.orderNumber || ''} eliminado exitosamente`;
      
      if (data.affectedInvoices && data.affectedInvoices.length > 0) {
        const cancelledCount = data.affectedInvoices.filter(inv => inv.wasCancelled).length;
        const deletedCount = data.affectedInvoices.filter(inv => !inv.wasCancelled).length;
        
        if (cancelledCount > 0) {
          message += `. ${cancelledCount} factura(s) impresa(s) cancelada(s) y stock devuelto`;
        }
        if (deletedCount > 0) {
          message += `. ${deletedCount} factura(s) no impresa(s) eliminada(s)`;
        }
      }
      
      if (data.affectedDeliveryNotes && data.affectedDeliveryNotes.length > 0) {
        message += `. ${data.affectedDeliveryNotes.length} remito(s) eliminado(s)`;
      }
      
      toast.success(message);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Error al eliminar el pedido');
    },
  });
};

export const useGenerateInvoice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, usdExchangeRate }: { id: number; usdExchangeRate?: number }) =>
      salesOrdersApi.generateInvoice(id, usdExchangeRate),
    onSuccess: (invoice: Invoice) => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(`Factura ${invoice.invoiceNumber} generada exitosamente`);
      return invoice;
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error || 'Error al generar la factura');
    },
  });
};

export const useGenerateDeliveryNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deliveryData }: { 
      id: number; 
      deliveryData?: {
        deliveryDate?: string;
        transporterId?: number;
        weightKg?: number;
        packagesCount?: number;
        declaredValue?: number;
        notes?: string;
      }
    }) => salesOrdersApi.generateDeliveryNote(id, deliveryData),
    onSuccess: (deliveryNote: DeliveryNote) => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] });
      toast.success(`Remito ${deliveryNote.deliveryNumber} generado exitosamente`);
      return deliveryNote;
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err?.response?.data?.error || 'Error al generar el remito');
    },
  });
};


