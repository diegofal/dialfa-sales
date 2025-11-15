import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SystemSettings, UpdateSettingsRequest } from '@/types/settings';

// Get system settings
export function useSystemSettings() {
  return useQuery<SystemSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - settings don't change often
  });
}

// Update system settings
export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateSettingsRequest) => {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch settings
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}




