import type {
  Feedback,
  CreateFeedbackDTO,
  UpdateFeedbackDTO,
  FeedbackResponse,
  FeedbackStatus,
  FeedbackType,
} from '@/types/feedback';
import { apiClient } from './client';

export const feedbackApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: FeedbackStatus;
    type?: FeedbackType;
  }): Promise<FeedbackResponse> => {
    const { data } = await apiClient.get<FeedbackResponse>('/feedback', { params });
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
