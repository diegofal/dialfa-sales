export interface Category {
  id: number;
  code: string;
  name: string;
  description?: string;
  defaultDiscountPercent: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  articlesCount: number;
}

export interface CategoryFormData {
  code: string;
  name: string;
  description?: string;
  defaultDiscountPercent: number;
}







