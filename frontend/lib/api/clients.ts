import { apiClient } from './client';
import type { ClientDto, CreateClientRequest, UpdateClientRequest } from '@/types/api';

export const clientsApi = {
  getAll: async (activeOnly: boolean = false): Promise<ClientDto[]> => {
    const { data } = await apiClient.get<ClientDto[]>('/clients', {
      params: { activeOnly },
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
