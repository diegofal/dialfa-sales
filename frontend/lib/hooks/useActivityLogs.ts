import { useQuery } from '@tanstack/react-query';
import { getActivityLogs } from '@/lib/api/activityLogs';
import { ActivityLogsFilters } from '@/types/activityLog';

export function useActivityLogs(filters: ActivityLogsFilters = {}) {
  return useQuery({
    queryKey: ['activity-logs', filters],
    queryFn: () => getActivityLogs(filters),
  });
}





