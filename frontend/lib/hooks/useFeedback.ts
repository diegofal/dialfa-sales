import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { feedbackApi } from '@/lib/api/feedback';
import type {
  CreateFeedbackDTO,
  UpdateFeedbackDTO,
  FeedbackType,
  FeedbackStatus,
} from '@/types/feedback';

interface UseFeedbackParams {
  page?: number;
  limit?: number;
  status?: FeedbackStatus;
  type?: FeedbackType;
}

/**
 * Fetch paginated feedback list with optional filters
 */
export function useFeedback(params: UseFeedbackParams = {}) {
  return useQuery({
    queryKey: ['feedback', params],
    queryFn: () =>
      feedbackApi.getAll({
        page: params.page || 1,
        limit: params.limit || 50,
        status: params.status,
        type: params.type,
      }),
  });
}

/**
 * Fetch single feedback by ID
 */
export function useFeedbackById(id: number) {
  return useQuery({
    queryKey: ['feedback', id],
    queryFn: () => feedbackApi.getById(id),
    enabled: !!id && id > 0,
  });
}

/**
 * Create new feedback
 */
export function useCreateFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFeedbackDTO) => feedbackApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback enviado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al enviar el feedback');
    },
  });
}

/**
 * Update existing feedback (admin only)
 */
export function useUpdateFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateFeedbackDTO }) =>
      feedbackApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback actualizado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar el feedback');
    },
  });
}

/**
 * Delete feedback
 */
export function useDeleteFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => feedbackApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback eliminado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar el feedback');
    },
  });
}
