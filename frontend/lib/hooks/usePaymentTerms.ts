import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PaymentTerm, PaymentTermFormData } from '@/types/paymentTerm';
import { paymentTermsApi } from '../api/paymentTerms';

interface UsePaymentTermsOptions {
  activeOnly?: boolean;
}

export function usePaymentTerms(options?: UsePaymentTermsOptions) {
  return useQuery({
    queryKey: ['payment-terms', options?.activeOnly],
    queryFn: () => paymentTermsApi.getAll({ activeOnly: options?.activeOnly ?? true }),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useCreatePaymentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PaymentTermFormData) => paymentTermsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
      toast.success('Condición de pago creada exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear condición de pago');
    },
  });
}

export function useUpdatePaymentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PaymentTermFormData }) =>
      paymentTermsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
      toast.success('Condición de pago actualizada exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar condición de pago');
    },
  });
}

export function useDeletePaymentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => paymentTermsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
      toast.success('Condición de pago eliminada exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar condición de pago');
    },
  });
}
