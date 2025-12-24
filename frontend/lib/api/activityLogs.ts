import { ActivityLogsFilters, ActivityLogsResponse } from '@/types/activityLog';

export async function getActivityLogs(filters: ActivityLogsFilters = {}): Promise<ActivityLogsResponse> {
  const query = new URLSearchParams();
  
  if (filters.page) query.append('page', filters.page.toString());
  if (filters.limit) query.append('limit', filters.limit.toString());
  if (filters.userId) query.append('userId', filters.userId);
  if (filters.operation) query.append('operation', filters.operation);
  if (filters.dateFrom) query.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) query.append('dateTo', filters.dateTo);
  if (filters.search) query.append('search', filters.search);

  const response = await fetch(`/api/activity-logs?${query.toString()}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch activity logs');
  }

  return response.json();
}


