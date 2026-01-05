import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PaymentTerm, PaymentTermFormData } from '@/types/paymentTerm';

interface UsePaymentTermsOptions {
  activeOnly?: boolean;
}

interface PaymentTermsResponse {
  data: PaymentTerm[];
}

async function fetchPaymentTerms(activeOnly = true): Promise<PaymentTermsResponse> {
  const queryParam = activeOnly ? '?activeOnly=true' : '';
  const response = await fetch(`/api/payment-terms${queryParam}`);
  if (!response.ok) {
    throw new Error('Failed to fetch payment terms');
  }
  const data = await response.json();
  return data; // Return the full response which includes { data: [...] }
}

async function createPaymentTerm(data: PaymentTermFormData): Promise<PaymentTerm> {
  const response = await fetch('/api/payment-terms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create payment term');
  }
  
  return response.json();
}

async function updatePaymentTerm(id: number, data: PaymentTermFormData): Promise<PaymentTerm> {
  const response = await fetch(`/api/payment-terms/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update payment term');
  }
  
  return response.json();
}

async function deletePaymentTerm(id: number): Promise<void> {
  const response = await fetch(`/api/payment-terms/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete payment term');
  }
}

export function usePaymentTerms(options?: UsePaymentTermsOptions) {
  return useQuery({
    queryKey: ['payment-terms', options?.activeOnly],
    queryFn: () => fetchPaymentTerms(options?.activeOnly ?? true),
    select: (response) => response.data, // Extract the data array
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useCreatePaymentTerm() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPaymentTerm,
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
      updatePaymentTerm(id, data),
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
    mutationFn: deletePaymentTerm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
      toast.success('Condición de pago eliminada exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar condición de pago');
    },
  });
}
