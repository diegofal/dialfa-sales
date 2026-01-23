import type { ClientDto, CreateClientRequest, UpdateClientRequest } from '@/types/api';
import type { PaginationParams } from '@/types/pagination';
import { clientsApi } from '../api/clients';
import { createCRUDHooks } from './api';

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

export {
  useList as useClients,
  useById as useClient,
  useCreate as useCreateClient,
  useUpdate as useUpdateClient,
  useDelete as useDeleteClient,
};
