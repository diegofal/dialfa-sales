export interface ActivityLog {
  id: number;
  user_id: number | null;
  username: string;
  operation: string;
  description: string;
  entity_type: string | null;
  entity_id: number | null;
  details: any | null;
  ip_address: string | null;
  created_at: string;
}

export interface ActivityLogsResponse {
  data: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ActivityLogChange {
  id: number;
  entityType: string;
  entityLabel: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
}

export interface ActivityLogsFilters {
  page?: number;
  limit?: number;
  userId?: string;
  operation?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}
