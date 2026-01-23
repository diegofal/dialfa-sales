import { User, UsersResponse, CreateUserDTO } from '@/types/user';
import { apiClient } from './client';

export const usersApi = {
  getAll: async (params?: { page?: number; limit?: number }): Promise<UsersResponse> => {
    const { data } = await apiClient.get<UsersResponse>('/users', {
      params: {
        page: params?.page || 1,
        limit: params?.limit || 50,
      },
    });
    return data;
  },

  getById: async (id: number): Promise<User> => {
    const { data } = await apiClient.get<User>(`/users/${id}`);
    return data;
  },

  create: async (userData: CreateUserDTO): Promise<User> => {
    const { data } = await apiClient.post<User>('/users', userData);
    return data;
  },

  update: async (
    id: number,
    userData: Partial<CreateUserDTO> & { isActive?: boolean }
  ): Promise<User> => {
    const { data } = await apiClient.put<User>(`/users/${id}`, userData);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },

  // Alias for semantic clarity
  deactivate: async (id: number): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },
};

// Legacy exports for backward compatibility (deprecated)
export const getUsers = usersApi.getAll;
export const createUser = usersApi.create;
export const updateUser = usersApi.update;
export const deactivateUser = usersApi.deactivate;
