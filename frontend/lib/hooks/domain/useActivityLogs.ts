import { useQuery } from '@tanstack/react-query';
import { getActivityLogChanges, getActivityLogs } from '@/lib/api/activityLogs';
import { ActivityLogsFilters } from '@/types/activityLog';

export function useActivityLogs(filters: ActivityLogsFilters = {}) {
  return useQuery({
    queryKey: ['activity-logs', filters],
    queryFn: () => getActivityLogs(filters),
  });
}

export function useActivityLogChanges(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ['activity-log-changes', id],
    queryFn: () => getActivityLogChanges(id),
    enabled,
  });
}
