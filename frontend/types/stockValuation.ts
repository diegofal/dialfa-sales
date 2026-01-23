export enum StockStatus {
  ACTIVE = 'active',
  SLOW_MOVING = 'slow_moving',
  DEAD_STOCK = 'dead_stock',
  NEVER_SOLD = 'never_sold',
}

export interface StockClassificationConfig {
  activeThresholdDays: number; // Default: 90
  slowMovingThresholdDays: number; // Default: 180
  deadStockThresholdDays: number; // Default: 365
  minSalesForActive: number; // Default: 5 unidades/mes
  trendMonths: number; // Default: 6
  includeZeroStock: boolean; // Default: false - Incluir artículos sin stock
}

export interface PaymentTermValuation {
  paymentTermId: number;
  paymentTermCode: string;
  paymentTermName: string;
  discountPercent: number;
  unitPriceWithDiscount: number;
  stockValueAtDiscountedPrice: number;
  potentialProfit: number;
}

export interface StockValuationMetrics {
  articleId: string;
  articleCode: string;
  articleDescription: string;
  status: StockStatus;

  // Categoría
  categoryId: number;
  categoryCode: string;
  categoryName: string;

  // Métricas temporales
  daysSinceLastSale: number | null;
  lastSaleDate: Date | null;

  // Métricas de ventas
  avgMonthlySales: number;
  salesTrend: number[];
  salesTrendDirection: 'increasing' | 'stable' | 'decreasing' | 'none';
  totalSalesInPeriod: number;

  // Métricas de stock
  currentStock: number;
  unitCost: number; // Costo unitario (last_purchase_price o cost_price)
  unitPrice: number; // Precio unitario de venta
  stockValue: number; // stock * cost_price
  stockValueAtListPrice: number; // stock * unit_price (sin descuento)
  potentialProfitAtListPrice: number; // Ganancia sin descuento

  // Valorización por condición de pago
  paymentTermsValuation: PaymentTermValuation[];

  // Métricas calculadas
  rotationVelocity: number; // Unidades vendidas por mes
  estimatedDaysToSellOut: number | null; // Días para agotar stock actual
  monthsOfInventory: number; // Meses de inventario actual
}

export interface CategoryValuationData {
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  count: number;
  totalValue: number;
  totalValueAtListPrice: number; // Sin descuento
  // Valorización por condición de pago
  paymentTermsValuation: PaymentTermValuation[];
  byStatus: {
    [key in StockStatus]: number; // count by status
  };
}

export interface StockValuationSummary {
  byStatus: {
    [key in StockStatus]: {
      count: number;
      totalValue: number;
      totalValueAtListPrice: number;
      // Valorización por condición de pago
      paymentTermsValuation: PaymentTermValuation[];
      articles: StockValuationMetrics[];
    };
  };
  byCategory: CategoryValuationData[];
  totals: {
    totalArticles: number;
    totalStockValue: number;
    totalValueAtListPrice: number;
    // Valorización por condición de pago
    paymentTermsValuation: PaymentTermValuation[];
  };
  calculatedAt: Date;
  config: StockClassificationConfig;
  cacheInfo?: StockValuationCacheInfo;
}

export interface StockValuationCacheInfo {
  isCached: boolean;
  age: number | null;
  ageHours: string | null;
  expiresIn: number | null;
  expiresInHours: string | null;
  calculatedAt: Date | null;
  articlesCount: number;
  config: StockClassificationConfig | null;
}
