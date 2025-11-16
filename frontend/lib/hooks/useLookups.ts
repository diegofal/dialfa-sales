import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

// Transporters
export function useTransporters() {
  return useQuery({
    queryKey: ['transporters'],
    queryFn: async () => {
      const { data } = await apiClient.get('/lookups/transporters');
      return data as Array<{
        id: number;
        name: string;
        address: string | null;
        phone: string | null;
        email: string | null;
        is_active: boolean;
      }>;
    },
  });
}

// Tax Conditions
export function useTaxConditions() {
  return useQuery({
    queryKey: ['tax-conditions'],
    queryFn: async () => {
      const { data } = await apiClient.get('/lookups/tax-conditions');
      return data as Array<{
        id: number;
        name: string;
        description: string | null;
      }>;
    },
  });
}

// Operation Types
export function useOperationTypes() {
  return useQuery({
    queryKey: ['operation-types'],
    queryFn: async () => {
      const { data } = await apiClient.get('/lookups/operation-types');
      return data as Array<{
        id: number;
        name: string;
        description: string | null;
      }>;
    },
  });
}

// Provinces
export function useProvinces() {
  return useQuery({
    queryKey: ['provinces'],
    queryFn: async () => {
      const { data } = await apiClient.get('/lookups/provinces');
      return data as Array<{
        id: number;
        name: string;
        code: string | null;
      }>;
    },
  });
}

// Payment Methods
export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data } = await apiClient.get('/lookups/payment-methods');
      return data as Array<{
        id: number;
        name: string;
        requires_check_data: boolean;
        is_active: boolean;
      }>;
    },
  });
}









