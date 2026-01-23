import { NextRequest } from 'next/server';

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  offset: number;
}

export function extractPaginationParams(
  request: NextRequest,
  defaults: { page?: number; limit?: number } = {}
): PaginationParams {
  const { searchParams } = new URL(request.url);
  const rawPage = parseInt(searchParams.get('page') || '');
  const rawLimit = parseInt(searchParams.get('limit') || '');
  const page = Math.max(1, isNaN(rawPage) ? defaults.page || 1 : rawPage);
  const limit = Math.min(200, Math.max(1, isNaN(rawLimit) ? defaults.limit || 50 : rawLimit));
  const search = searchParams.get('search') || undefined;
  const offset = (page - 1) * limit;

  return { page, limit, search, offset };
}
