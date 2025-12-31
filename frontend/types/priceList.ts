export interface PaymentDiscount {
  paymentTermId: number;
  paymentTermCode: string;
  paymentTermName: string;
  discountPercent: number;
}

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
  isActive: boolean;
  isDiscontinued: boolean;
  displayOrder?: string;
  type?: string;
  series?: number;
  thickness?: string;
  size?: string;
}

export interface PriceListByCategory {
  categoryId: number;
  categoryName: string;
  categoryCode: string;
  paymentDiscounts: PaymentDiscount[];
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
