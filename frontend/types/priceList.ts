export interface PriceListItem {
  id: number;
  code: string;
  description: string;
  unitPrice: number;
  stock: number;
  costPrice?: number;
  cifPercentage?: number;
  categoryId: number;
  categoryName: string;
  categoryDiscount: number;
  isActive: boolean;
  isDiscontinued: boolean;
}

export interface PriceListByCategory {
  categoryId: number;
  categoryName: string;
  categoryCode: string;
  categoryDiscount: number;
  items: PriceListItem[];
  totalItems: number;
}

export interface BulkPriceUpdate {
  articleId: number;
  newPrice: number;
}

export interface PriceListResponse {
  data: PriceListByCategory[];
  totalArticles: number;
  totalCategories: number;
}

export interface PriceListFilters {
  categoryId?: number;
  search?: string;
  activeOnly?: boolean;
}

