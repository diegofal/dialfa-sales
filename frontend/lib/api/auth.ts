import apiClient from './client';
import type { LoginRequest, LoginResponse } from '@/types/api';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  validate: async (): Promise<boolean> => {
    try {
      await apiClient.get('/auth/validate');
      return true;
    } catch {
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};


