import type { PaymentTerm, PaymentTermFormData } from '@/types/paymentTerm';
import { apiClient } from './client';

interface PaymentTermsResponse {
  data: PaymentTerm[];
}

export const paymentTermsApi = {
  getAll: async (params?: { activeOnly?: boolean }): Promise<PaymentTerm[]> => {
    const { data } = await apiClient.get<PaymentTermsResponse>('/payment-terms', {
      params: {
        activeOnly: params?.activeOnly ?? true,
      },
    });
    return data.data; // Extract the array from the response
  },

  getById: async (id: number): Promise<PaymentTerm> => {
    const { data } = await apiClient.get<PaymentTerm>(`/payment-terms/${id}`);
    return data;
  },

  create: async (termData: PaymentTermFormData): Promise<PaymentTerm> => {
    const { data } = await apiClient.post<PaymentTerm>('/payment-terms', termData);
    return data;
  },

  update: async (id: number, termData: PaymentTermFormData): Promise<PaymentTerm> => {
    const { data } = await apiClient.put<PaymentTerm>(`/payment-terms/${id}`, termData);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/payment-terms/${id}`);
  },
};
