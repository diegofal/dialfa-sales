import { useState, useEffect, useCallback } from 'react';
import { Feedback, CreateFeedbackDTO, UpdateFeedbackDTO, FeedbackResponse, FeedbackType, FeedbackStatus } from '@/types/feedback';

export function useFeedback() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const fetchFeedbacks = useCallback(async (
    page = 1, 
    status?: FeedbackStatus,
    type?: FeedbackType
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (status) params.append('status', status);
      if (type) params.append('type', type);

      const response = await fetch(`/api/feedback?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch feedback');
      }
      const data: FeedbackResponse = await response.json();
      setFeedbacks(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const createFeedback = async (data: CreateFeedbackDTO) => {
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to create feedback');
      }
      const newFeedback: Feedback = await response.json();
      setFeedbacks(prev => [newFeedback, ...prev]);
      return newFeedback;
    } catch (err) {
      throw err instanceof Error ? err : new Error('An error occurred');
    }
  };

  const updateFeedback = async (id: number, data: UpdateFeedbackDTO) => {
    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update feedback');
      }
      const updatedFeedback: Feedback = await response.json();
      setFeedbacks(prev => 
        prev.map(f => f.id === id ? updatedFeedback : f)
      );
      return updatedFeedback;
    } catch (err) {
      throw err instanceof Error ? err : new Error('An error occurred');
    }
  };

  const deleteFeedback = async (id: number) => {
    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete feedback');
      }
      setFeedbacks(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      throw err instanceof Error ? err : new Error('An error occurred');
    }
  };

  return {
    feedbacks,
    isLoading,
    error,
    pagination,
    fetchFeedbacks,
    createFeedback,
    updateFeedback,
    deleteFeedback,
  };
}



