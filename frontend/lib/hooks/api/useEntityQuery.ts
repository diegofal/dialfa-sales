import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import type { PaginationParams } from '@/types/pagination';

interface EntityQueryConfig<TData> {
  queryKey: unknown[];
  endpoint: string;
  params?: PaginationParams & Record<string, unknown>;
  enabled?: boolean;
  queryOptions?: Omit<UseQueryOptions<TData, unknown, TData>, 'queryKey' | 'queryFn' | 'enabled'>;
}

async function fetchEntity<TData>(
  endpoint: string,
  params?: Record<string, unknown>
): Promise<TData> {
  const { data } = await apiClient.get<TData>(endpoint, { params });
  return data;
}

export function useEntityQuery<TData = unknown>({
  queryKey,
  endpoint,
  params,
  enabled = true,
  queryOptions,
}: EntityQueryConfig<TData>) {
  return useQuery<TData, unknown, TData>({
    queryKey: params ? [...queryKey, params] : queryKey,
    queryFn: () => fetchEntity<TData>(endpoint, params),
    enabled,
    ...queryOptions,
  });
}

interface EntityByIdConfig<TData> {
  queryKey: unknown[];
  endpoint: string;
  id: number | string;
  enabled?: boolean;
  queryOptions?: Omit<UseQueryOptions<TData, unknown, TData>, 'queryKey' | 'queryFn' | 'enabled'>;
}

export function useEntityById<TData = unknown>({
  queryKey,
  endpoint,
  id,
  enabled,
  queryOptions,
}: EntityByIdConfig<TData>) {
  return useQuery<TData, unknown, TData>({
    queryKey: [...queryKey, id],
    queryFn: () => fetchEntity<TData>(`${endpoint}/${id}`),
    enabled: enabled ?? !!id,
    ...queryOptions,
  });
}
