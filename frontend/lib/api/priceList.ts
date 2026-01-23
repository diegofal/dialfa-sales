import { PriceListResponse, PriceListFilters, BulkPriceUpdate } from '@/types/priceList';

export async function fetchPriceLists(filters?: PriceListFilters): Promise<PriceListResponse> {
  const params = new URLSearchParams();

  if (filters?.categoryId) {
    params.append('categoryId', filters.categoryId.toString());
  }

  if (filters?.search) {
    params.append('search', filters.search);
  }

  // Only send activeOnly if it's explicitly true
  if (filters?.activeOnly === true) {
    params.append('activeOnly', 'true');
  }

  const response = await fetch(`/api/price-lists?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch price lists' }));
    throw new Error(error.error || 'Failed to fetch price lists');
  }

  return response.json();
}

export async function updatePrices(payload: {
  updates: BulkPriceUpdate[];
  changeType?: 'manual' | 'csv_import' | 'bulk_update';
  notes?: string;
}): Promise<{
  success: boolean;
  updatedCount: number;
  articles: Array<{
    id: number;
    code: string;
    description: string;
    unitPrice: number;
    categoryName: string;
  }>;
}> {
  const response = await fetch(`/api/price-lists/bulk-update`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update prices' }));
    throw new Error(error.error || 'Failed to update prices');
  }

  return response.json();
}
