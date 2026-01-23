export interface Invoice {
  id: number;
  invoiceNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  clientId: number;
  clientBusinessName: string;
  clientCuit: string;
  clientTaxCondition: string;
  invoiceDate: string;
  paymentTermId: number | null;
  paymentTermName: string | null;
  usdExchangeRate: number | null;
  specialDiscountPercent: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  isPrinted: boolean;
  printedAt: string | null;
  isCancelled: boolean;
  cancelledAt: string | null;
  cancellationReason: string | null;
  isCreditNote: boolean;
  isQuotation: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: number;
  salesOrderItemId: number | null;
  articleId: number;
  articleCode: string;
  articleDescription: string;
  quantity: number;
  unitPriceUsd: number;
  unitPriceArs: number;
  discountPercent: number;
  lineTotal: number;
  createdAt: string;
}

export interface InvoiceListDto {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  clientBusinessName: string;
  salesOrderId: number;
  salesOrderNumber: string;
  totalAmount: number;
  isPrinted: boolean;
  isCancelled: boolean;
}

export interface CreateInvoiceRequest {
  salesOrderId: number;
  invoiceDate: string;
  paymentTermId: number | null;
  usdExchangeRate: number | null;
  specialDiscountPercent: number;
  notes: string | null;
}

export interface UpdateInvoiceRequest {
  id: number;
  invoiceDate: string;
  paymentTermId: number | null;
  usdExchangeRate: number | null;
  specialDiscountPercent: number;
  notes: string | null;
}

export interface CancelInvoiceRequest {
  cancellationReason: string;
}
