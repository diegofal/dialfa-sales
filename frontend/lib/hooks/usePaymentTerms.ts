import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PaymentTerm, PaymentTermFormData } from '@/types/paymentTerm';

const API_BASE = '/api/payment-terms';

// Fetch all payment terms
export function usePaymentTerms(activeOnly: boolean = false) {
  return useQuery({
    queryKey: ['payment-terms', activeOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeOnly) {
        params.append('activeOnly', 'true');
      }
      const response = await fetch(`${API_BASE}?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch payment terms');
      }
      const data = await response.json();
      return data.data as PaymentTerm[];
    },
  });
}

// Fetch a single payment term
export function usePaymentTerm(id: number) {
  return useQuery({
    queryKey: ['payment-terms', id],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch payment term');
      }
      return response.json() as Promise<PaymentTerm>;
    },
    enabled: id > 0,
  });
}

// Create payment term
export function useCreatePaymentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PaymentTermFormData) => {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment term');
      }

      return response.json() as Promise<PaymentTerm>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
      toast.success('Condición de pago creada correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear condición de pago');
    },
  });
}

// Update payment term
export function useUpdatePaymentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PaymentTermFormData> }) => {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update payment term');
      }

      return response.json() as Promise<PaymentTerm>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
      queryClient.invalidateQueries({ queryKey: ['payment-terms', variables.id] });
      toast.success('Condición de pago actualizada correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar condición de pago');
    },
  });
}

// Delete payment term
export function useDeletePaymentTerm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete payment term');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
      toast.success('Condición de pago eliminada correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar condición de pago');
    },
  });
}

