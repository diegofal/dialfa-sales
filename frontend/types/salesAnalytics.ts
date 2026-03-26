export interface SalesAnalyticsParams {
  periodMonths: number; // 1, 3, 6, 12, 24
  startDate?: string; // ISO date for custom range
  endDate?: string; // ISO date for custom range
  categoryId?: number; // optional category filter
}

export interface SalesKPIs {
  totalRevenue: number;
  totalUnits: number;
  avgOrderValue: number;
  uniqueArticlesSold: number;
  invoiceCount: number;
}

export interface RevenueByMonth {
  month: string; // "2024-01"
  label: string; // "ene. 24"
  revenue: number;
  units: number;
  invoiceCount: number;
}

export interface SalesByCategory {
  categoryId: number;
  categoryName: string;
  revenue: number;
  percentage: number;
}

export interface TopArticle {
  articleId: number;
  code: string;
  description: string;
  categoryName: string;
  revenue: number;
  units: number;
}

export interface StockEvolutionPoint {
  month: string; // "2024-01"
  label: string; // "ene. 24"
  totalStockValue: number;
}

export interface SalesAnalyticsResponse {
  kpis: SalesKPIs;
  revenueByMonth: RevenueByMonth[];
  salesByCategory: SalesByCategory[];
  topArticles: TopArticle[];
  stockEvolution: StockEvolutionPoint[];
}
