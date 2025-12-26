import { Article } from './article';

export type SupplierOrderStatus = 'draft' | 'confirmed' | 'sent' | 'in_transit' | 'received' | 'cancelled';

export interface SupplierOrderItem {
  article: Article;
  quantity: number;
  currentStock: number;
  minimumStock: number;
  avgMonthlySales: number; // WMA - Weighted Moving Average
  estimatedSaleTime: number; // in months, based on WMA
}

export interface SupplierOrder {
  id: number;
  orderNumber: string;
  supplierId?: number | null;
  supplierName?: string | null;
  status: SupplierOrderStatus;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  totalItems: number;
  totalQuantity: number;
  estimatedSaleTimeMonths?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  items?: SupplierOrderItemDto[];
}

export interface SupplierOrderItemDto {
  id: number;
  supplierOrderId: number;
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  currentStock: number;
  minimumStock: number;
  avgMonthlySales?: number | null;
  estimatedSaleTime?: number | null;
  receivedQuantity: number;
  createdAt: string;
}

export interface SupplierOrderFormData {
  supplierId?: number;
  expectedDeliveryDate?: string;
  notes?: string;
  items: {
    articleId: number;
    articleCode: string;
    articleDescription: string;
    quantity: number;
    currentStock: number;
    minimumStock: number;
    avgMonthlySales?: number;
    estimatedSaleTime?: number;
  }[];
}

export interface SupplierOrderListDto {
  orders: SupplierOrder[];
  total: number;
}


