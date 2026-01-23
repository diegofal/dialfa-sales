export type FeedbackType = 'bug' | 'improvement' | 'feature' | 'other';
export type FeedbackStatus = 'pending' | 'in-review' | 'resolved' | 'dismissed';
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Feedback {
  id: number;
  userId: number | null;
  username: string;
  fullName: string;
  type: FeedbackType;
  subject: string;
  description: string;
  status: FeedbackStatus;
  priority: FeedbackPriority | null;
  adminNotes: string | null;
  resolvedAt: string | null;
  resolvedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeedbackDTO {
  type: FeedbackType;
  subject: string;
  description: string;
}

export interface UpdateFeedbackDTO {
  status?: FeedbackStatus;
  priority?: FeedbackPriority | null;
  adminNotes?: string | null;
}

export interface FeedbackResponse {
  data: Feedback[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
