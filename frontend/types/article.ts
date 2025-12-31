export interface Article {
  id: number;
  code: string;
  description: string;
  categoryId: number;
  categoryName: string;
  categoryDefaultDiscount: number;
  unitPrice: number;
  stock: number;
  minimumStock: number;
  location: string | null;
  isDiscontinued: boolean;
  notes: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  isLowStock: boolean;
  stockStatus: string;
  abcClass?: 'A' | 'B' | 'C' | null;
  salesTrend?: number[];
  salesTrendLabels?: string[];
  lastSaleDate?: string | null; // ISO date string
  weightKg?: number | null;
  lastPurchasePrice?: number | null;
  cifPercentage?: number | null;
}

export interface ArticleFormData {
  code: string;
  description: string;
  categoryId: number;
  unitPrice: number;
  stock: number;
  minimumStock: number;
  location?: string;
  isDiscontinued: boolean;
  notes?: string;
}

export interface ArticleListDto {
  articles: Article[];
  total: number;
}





