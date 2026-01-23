import { PriceHistoryResponse, PriceHistoryFilters } from '@/types/priceHistory';

export async function fetchPriceHistory(
  filters?: PriceHistoryFilters
): Promise<PriceHistoryResponse> {
  const params = new URLSearchParams();

  if (filters?.articleId) params.append('articleId', filters.articleId.toString());
  if (filters?.categoryId) params.append('categoryId', filters.categoryId.toString());
  if (filters?.changeType) params.append('changeType', filters.changeType);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const response = await fetch(`/api/price-history?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch price history');
  }

  return response.json();
}
