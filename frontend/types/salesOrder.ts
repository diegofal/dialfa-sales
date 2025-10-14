export interface SalesOrder {
  id: number;
  clientId: number;
  clientBusinessName: string;
  orderNumber: string;
  orderDate: string;
  deliveryDate?: string;
  status: 'PENDING' | 'INVOICED' | 'CANCELLED';
  total: number;
  notes?: string;
  itemsCount: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  items: SalesOrderItem[];
}

export interface SalesOrderItem {
  id: number;
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
}

export interface SalesOrderListDto {
  id: number;
  orderNumber: string;
  orderDate: string;
  deliveryDate?: string;
  clientBusinessName: string;
  status: string;
  total: number;
  itemsCount: number;
}

export interface CreateSalesOrderRequest {
  clientId: number;
  orderDate: string;
  deliveryDate?: string;
  notes?: string;
  items: CreateSalesOrderItemRequest[];
}

export interface CreateSalesOrderItemRequest {
  articleId: number;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

export interface UpdateSalesOrderRequest {
  id: number;
  orderDate: string;
  deliveryDate?: string;
  notes?: string;
  items: UpdateSalesOrderItemRequest[];
}

export interface UpdateSalesOrderItemRequest {
  id?: number; // null for new items
  articleId: number;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

// For wizard state
export interface SalesOrderFormData {
  clientId?: number;
  orderDate: string;
  deliveryDate?: string;
  notes?: string;
  items: SalesOrderItemFormData[];
}

export interface SalesOrderItemFormData {
  articleId: number;
  articleCode?: string;
  articleDescription?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

