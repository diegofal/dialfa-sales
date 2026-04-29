export interface PaymentDiscountSource {
  categoryPaymentDiscounts?: Array<{
    paymentTermId?: number | null;
    discountPercent: number;
  }> | null;
  categoryDefaultDiscount?: number | null;
}

/**
 * Returns the discount % for a given (article, paymentTermId), matching the
 * canonical logic used by InvoiceService when generating/regenerating invoices.
 *
 * Lookup priority:
 *   1. category_payment_discounts row matching paymentTermId
 *   2. category default_discount_percent (legacy fallback)
 *   3. 0
 */
export function getArticleDiscountForPaymentTerm(
  source: PaymentDiscountSource,
  paymentTermId: number | null | undefined
): number {
  if (!paymentTermId) return 0;
  const match = source.categoryPaymentDiscounts?.find((d) => d.paymentTermId === paymentTermId);
  if (match) return match.discountPercent;
  return source.categoryDefaultDiscount ?? 0;
}
