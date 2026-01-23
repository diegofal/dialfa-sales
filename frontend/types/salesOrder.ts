export interface SalesOrder {
  id: number;
  clientId: number;
  clientBusinessName: string;
  clientCuit: string;
  orderNumber: string;
  orderDate: string;
  deliveryDate?: string;
  status: 'PENDING' | 'INVOICED' | 'CANCELLED' | 'COMPLETED';
  paymentTermId: number | null;
  paymentTermName: string | null;
  total: number;
  specialDiscountPercent: number;
  notes?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  items?: SalesOrderItem[];
  // Related documents for permission calculations
  invoice?: {
    id: number;
    invoiceNumber: string;
    isPrinted: boolean;
    isCancelled: boolean;
  } | null;
  deliveryNote?: {
    id: number;
    deliveryNumber: string;
    deliveryDate: string;
    isPrinted: boolean;
  } | null;
}

export interface SalesOrderUpdateResponse extends SalesOrder {
  regenerated?: {
    invoices: number;
    deliveryNotes: number;
    message: string;
  };
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
  stock?: number; // Current stock of the article
}

export interface SalesOrderListDto {
  id: number;
  orderNumber: string;
  orderDate: string;
  deliveryDate?: string;
  clientBusinessName: string;
  status: string;
  total: number;
  paymentTermId?: number | null;
  // For permission calculations
  hasInvoice: boolean;
  invoicePrinted: boolean;
}

export interface CreateSalesOrderRequest {
  clientId: number;
  paymentTermId?: number | null;
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
  clientId: number;
  paymentTermId?: number | null;
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
  orderDate?: string;
  deliveryDate?: string;
  paymentTermId?: number | null;
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
