import type { Feedback, CreateFeedbackDTO, UpdateFeedbackDTO } from '@/types/feedback';
import type { PaginationParams } from '@/types/pagination';
import { feedbackApi } from '../api/feedback';
import { createCRUDHooks } from './api/createCRUDHooks';

export interface FeedbackListParams extends PaginationParams {
  status?: string;
  type?: string;
}

// Generate CRUD hooks using factory pattern
const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  Feedback,
  CreateFeedbackDTO,
  UpdateFeedbackDTO,
  FeedbackListParams
>({
  entityName: 'Feedback',
  api: feedbackApi,
  queryKey: 'feedback',
});

// Export hooks with semantic names
export {
  useList as useFeedback,
  useById as useFeedbackById,
  useCreate as useCreateFeedback,
  useUpdate as useUpdateFeedback,
  useDelete as useDeleteFeedback,
};
