import { apiClient } from './client';
import type { Client, ClientFormData } from '@/types/api';

export const clientsApi = {
  getAll: async (activeOnly: boolean = false): Promise<Client[]> => {
    const { data } = await apiClient.get<Client[]>('/clients', {
      params: { activeOnly },
    });
    return data;
  },

  getById: async (id: number): Promise<Client> => {
    const { data } = await apiClient.get<Client>(`/clients/${id}`);
    return data;
  },

  create: async (clientData: ClientFormData): Promise<Client> => {
    const { data } = await apiClient.post<Client>('/clients', clientData);
    return data;
  },

  update: async (id: number, clientData: ClientFormData): Promise<Client> => {
    const { data } = await apiClient.put<Client>(`/clients/${id}`, {
      id,
      ...clientData,
    });
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/clients/${id}`);
  },
};

