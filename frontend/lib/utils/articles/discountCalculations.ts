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
 *   1. category_payment_discounts row matching paymentTermId (when present)
 *   2. category default_discount_percent (always tried as fallback)
 *   3. 0
 *
 * Note: when `paymentTermId` is null/undefined we still fall back to the
 * category default so the user sees a baseline discount on a fresh pedido
 * before they've selected a condición de pago. The form additionally falls
 * back to the client's default payment term before reaching here, so the
 * "no payment term at all" path is the rare case.
 */
export function getArticleDiscountForPaymentTerm(
  source: PaymentDiscountSource,
  paymentTermId: number | null | undefined
): number {
  if (paymentTermId) {
    const match = source.categoryPaymentDiscounts?.find((d) => d.paymentTermId === paymentTermId);
    if (match) return match.discountPercent;
  }
  return source.categoryDefaultDiscount ?? 0;
}
