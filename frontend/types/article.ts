export interface Article {
  id: number;
  code: string;
  description: string;
  categoryId: number;
  categoryName: string;
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




