import { apiClient } from './client';
import type { ClientDto, CreateClientRequest, UpdateClientRequest } from '@/types/api';
import type { PagedResult, PaginationParams } from '@/types/pagination';

export const clientsApi = {
  getAll: async (params: PaginationParams & { activeOnly?: boolean } = {}): Promise<PagedResult<ClientDto>> => {
    const { data } = await apiClient.get<PagedResult<ClientDto>>('/clients', {
      params,
    });
    return data;
  },

  getById: async (id: number): Promise<ClientDto> => {
    const { data } = await apiClient.get<ClientDto>(`/clients/${id}`);
    return data;
  },

  create: async (clientData: CreateClientRequest): Promise<ClientDto> => {
    const { data } = await apiClient.post<ClientDto>('/clients', clientData);
    return data;
  },

  update: async (id: number, clientData: UpdateClientRequest): Promise<ClientDto> => {
    const { data } = await apiClient.put<ClientDto>(`/clients/${id}`, {
      ...clientData,
      id,
    });
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/clients/${id}`);
  },
};
