import { useQuery } from '@tanstack/react-query';
import type { ClientDto, CreateClientRequest, UpdateClientRequest } from '@/types/api';
import type { PaginationParams } from '@/types/pagination';
import { clientsApi } from '../../api/clients';
import { createCRUDHooks } from '../api';

export interface ClientsListParams extends PaginationParams {
  includeTrends?: boolean;
  trendMonths?: number;
  includeClassification?: boolean;
  classificationStatus?: string;
  classificationConfig?: Record<string, number>;
}

const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  ClientDto,
  CreateClientRequest,
  UpdateClientRequest,
  ClientsListParams
>({
  entityName: 'Cliente',
  api: clientsApi,
  queryKey: 'clients',
});

// Query key for next code
const clientKeys = {
  all: ['clients'] as const,
  nextCode: () => [...clientKeys.all, 'next-code'] as const,
};

// Hook for getting next available client code
export function useNextClientCode() {
  return useQuery({
    queryKey: clientKeys.nextCode(),
    queryFn: async () => {
      const response = await fetch('/api/clients/next-code');
      if (!response.ok) throw new Error('Failed to fetch next client code');
      const data = await response.json();
      return data.code as string;
    },
    staleTime: 0, // Always fetch fresh data
  });
}

export {
  useList as useClients,
  useById as useClient,
  useCreate as useCreateClient,
  useUpdate as useUpdateClient,
  useDelete as useDeleteClient,
};
