export interface PaymentTerm {
  id: number;
  code: string;
  name: string;
  days: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTermFormData {
  code: string;
  name: string;
  days: number;
  isActive?: boolean;
}

export interface CategoryPaymentDiscount {
  paymentTermId: number;
  paymentTermCode: string;
  paymentTermName: string;
  paymentTermDays: number;
  discountPercent: number;
}

export interface CategoryPaymentDiscountFormData {
  paymentTermId: number;
  discountPercent: number;
}

