import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  SupplierOrder,
  SupplierOrderFormData,
  SupplierOrderStatus,
} from '@/types/supplierOrder';
import { supplierOrdersApi } from '../api/supplierOrders';

interface SupplierOrdersResponse {
  success: boolean;
  data: SupplierOrder[];
}

/**
 * Fetch all supplier orders with optional filters
 */
export function useSupplierOrders(
  params?: { status?: SupplierOrderStatus; supplierId?: number },
  options?: Omit<UseQueryOptions<SupplierOrdersResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['supplier-orders', params],
    queryFn: () => supplierOrdersApi.getAll(params),
    ...options,
  });
}

/**
 * Fetch single supplier order by ID
 */
export function useSupplierOrder(id: number) {
  return useQuery({
    queryKey: ['supplier-orders', id],
    queryFn: () => supplierOrdersApi.getById(id),
    enabled: !!id && id > 0,
  });
}

/**
 * Create supplier order (supports silent mode for optimistic updates)
 */
export function useCreateSupplierOrder(options?: { silent?: boolean }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (order: SupplierOrderFormData) => supplierOrdersApi.create(order),
    onSuccess: () => {
      if (!options?.silent) {
        queryClient.invalidateQueries({ queryKey: ['supplier-orders'] });
        toast.success('Pedido creado exitosamente');
      }
    },
    onError: (error: Error) => {
      if (!options?.silent) {
        toast.error(error.message || 'Error al crear el pedido');
      }
    },
  });
}

/**
 * Update supplier order (supports silent mode for optimistic updates)
 */
export function useUpdateSupplierOrder(options?: { silent?: boolean }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, order }: { id: number; order: Partial<SupplierOrderFormData> }) =>
      supplierOrdersApi.update(id, order),
    onSuccess: () => {
      if (!options?.silent) {
        queryClient.invalidateQueries({ queryKey: ['supplier-orders'] });
        toast.success('Pedido actualizado exitosamente');
      }
    },
    onError: (error: Error) => {
      if (!options?.silent) {
        toast.error(error.message || 'Error al actualizar el pedido');
      }
    },
  });
}

/**
 * Update supplier order status
 */
export function useUpdateSupplierOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: SupplierOrderStatus }) =>
      supplierOrdersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-orders'] });
      toast.success('Estado actualizado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar el estado');
    },
  });
}

/**
 * Delete supplier order
 */
export function useDeleteSupplierOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => supplierOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-orders'] });
      toast.success('Pedido eliminado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar el pedido');
    },
  });
}
