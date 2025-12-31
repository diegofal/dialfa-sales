export interface PriceHistory {
  id: number;
  articleId: number;
  articleCode?: string;
  articleDescription?: string;
  oldPrice: number;
  newPrice: number;
  changeType: 'manual' | 'csv_import' | 'bulk_update' | 'price_revert';
  changeBatchId?: string;
  changedBy?: number;
  changedByName?: string;
  notes?: string;
  createdAt: string;
  priceChange: number;
  priceChangePercent: number;
}

export interface PriceHistoryResponse {
  data: PriceHistory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PriceHistoryFilters {
  articleId?: number;
  categoryId?: number;
  startDate?: string;
  endDate?: string;
  changeType?: string;
  page?: number;
  limit?: number;
}

