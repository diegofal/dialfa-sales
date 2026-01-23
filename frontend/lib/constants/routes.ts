export const ROUTES = {
  DASHBOARD: '/dashboard',
  ARTICLES: '/dashboard/articles',
  ARTICLES_VALUATION: '/dashboard/articles/valuation',
  CLIENTS: '/dashboard/clients',
  CATEGORIES: '/dashboard/categories',
  CERTIFICATES: '/dashboard/certificates',
  SALES_ORDERS: '/dashboard/sales-orders',
  SALES_ORDERS_NEW: '/dashboard/sales-orders/new',
  INVOICES: '/dashboard/invoices',
  INVOICES_NEW: '/dashboard/invoices/new',
  DELIVERY_NOTES: '/dashboard/delivery-notes',
  PRICE_LISTS: '/dashboard/price-lists',
  SUPPLIERS: '/dashboard/suppliers',
  SUPPLIER_ORDERS: '/dashboard/supplier-orders',
  PAYMENT_TERMS: '/dashboard/payment-terms',
  ACTIVITY: '/dashboard/activity',
  USERS: '/dashboard/users',
  SETTINGS: '/dashboard/settings',
  FEEDBACK: '/dashboard/feedback',
  FEEDBACK_ADMIN: '/dashboard/feedback/admin',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
