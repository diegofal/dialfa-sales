import type { ClientDto, CreateClientRequest, UpdateClientRequest } from '@/types/api';
import type { PagedResult, PaginationParams } from '@/types/pagination';
import { apiClient } from './client';

export const clientsApi = {
  getAll: async (
    params: PaginationParams & {
      searchTerm?: string;
      includeTrends?: boolean;
      trendMonths?: number;
      includeClassification?: boolean;
      classificationStatus?: string;
    } = {}
  ): Promise<PagedResult<ClientDto>> => {
    const apiParams = {
      page: params.pageNumber || 1,
      limit: params.pageSize || 50,
      search: params.searchTerm,
      includeTrends: params.includeTrends,
      trendMonths: params.trendMonths,
      includeClassification: params.includeClassification,
      classificationStatus: params.classificationStatus,
    };

    const { data } = await apiClient.get<PagedResult<ClientDto>>('/clients', {
      params: apiParams,
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
