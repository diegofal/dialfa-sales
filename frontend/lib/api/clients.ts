import apiClient from './client';
import type { ClientDto, CreateClientRequest, UpdateClientRequest } from '@/types/api';

export const clientsApi = {
  getAll: async (activeOnly: boolean = false): Promise<ClientDto[]> => {
    const response = await apiClient.get<ClientDto[]>('/api/clients', {
      params: { activeOnly },
    });
    return response.data;
  },

  getById: async (id: number): Promise<ClientDto> => {
    const response = await apiClient.get<ClientDto>(`/api/clients/${id}`);
    return response.data;
  },

  create: async (data: CreateClientRequest): Promise<ClientDto> => {
    const response = await apiClient.post<ClientDto>('/api/clients', data);
    return response.data;
  },

  update: async (id: number, data: UpdateClientRequest): Promise<ClientDto> => {
    const response = await apiClient.put<ClientDto>(`/api/clients/${id}`, {
      ...data,
      id,
    });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/clients/${id}`);
  },
};

