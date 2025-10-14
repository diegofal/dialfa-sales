import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesOrdersApi } from '../api/salesOrders';
import { PaginationParams } from '@/types/pagination';
import type { CreateSalesOrderRequest, UpdateSalesOrderRequest } from '@/types/salesOrder';
import { toast } from 'sonner';

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

  return useMutation({
    mutationFn: (id: number) => salesOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      toast.success('Pedido eliminado exitosamente');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || 'Error al eliminar el pedido');
    },
  });
};

