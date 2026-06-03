export interface PagedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  /**
   * Articles only — total units sold across the full filtered set when
   * `soldInPeriod` is active. Independent of pagination.
   */
  totalUnitsSoldInPeriod?: number;
  /**
   * Articles only — sales totals (SPISA data) across the full filtered set
   * when `soldInPeriod` is active. Independent of pagination.
   */
  salesSummaryInPeriod?: {
    netAmount: number;
    totalWithIva: number;
    invoiceCount: number;
    unitsSold: number;
  };
}

export interface PaginationParams {
  pageNumber?: number;
  pageSize?: number;
  sortBy?: string;
  sortDescending?: boolean;
  searchTerm?: string;
}

export interface PaginationState {
  pageNumber: number;
  pageSize: number;
  sortBy?: string;
  sortDescending: boolean;
}
