import type { Feedback, CreateFeedbackDTO, UpdateFeedbackDTO } from '@/types/feedback';
import type { PagedResult } from '@/types/pagination';
import { apiClient } from './client';

export const feedbackApi = {
  getAll: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    status?: string;
    type?: string;
  }): Promise<PagedResult<Feedback>> => {
    const apiParams = {
      page: params?.pageNumber || 1,
      limit: params?.pageSize || 50,
      status: params?.status,
      type: params?.type,
    };
    const { data } = await apiClient.get<PagedResult<Feedback>>('/feedback', { params: apiParams });
    return data;
  },

  getById: async (id: number): Promise<Feedback> => {
    const { data } = await apiClient.get<Feedback>(`/feedback/${id}`);
    return data;
  },

  create: async (feedbackData: CreateFeedbackDTO): Promise<Feedback> => {
    const { data } = await apiClient.post<Feedback>('/feedback', feedbackData);
    return data;
  },

  update: async (id: number, feedbackData: UpdateFeedbackDTO): Promise<Feedback> => {
    const { data } = await apiClient.patch<Feedback>(`/feedback/${id}`, feedbackData);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/feedback/${id}`);
  },
};
