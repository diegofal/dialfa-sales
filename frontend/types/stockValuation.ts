export enum StockStatus {
  ACTIVE = 'active',
  SLOW_MOVING = 'slow_moving',
  DEAD_STOCK = 'dead_stock',
  NEVER_SOLD = 'never_sold'
}

export interface StockClassificationConfig {
  activeThresholdDays: number;      // Default: 90
  slowMovingThresholdDays: number;  // Default: 180
  deadStockThresholdDays: number;   // Default: 365
  minSalesForActive: number;        // Default: 5 unidades/mes
  trendMonths: number;              // Default: 6
  includeZeroStock: boolean;        // Default: false - Incluir artículos sin stock
}

export interface StockValuationMetrics {
  articleId: string;
  articleCode: string;
  articleDescription: string;
  status: StockStatus;
  
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
  stockValue: number;              // stock * cost_price
  stockValueAtSalePrice: number;   // stock * unit_price
  potentialProfit: number;         // Diferencia entre precio venta y costo
  
  // Métricas calculadas
  rotationVelocity: number;        // Unidades vendidas por mes
  estimatedDaysToSellOut: number | null; // Días para agotar stock actual
  monthsOfInventory: number;       // Meses de inventario actual
}

export interface StockValuationSummary {
  byStatus: {
    [key in StockStatus]: {
      count: number;
      totalValue: number;
      totalValueAtSale: number;
      totalPotentialProfit: number;
      articles: StockValuationMetrics[];
    }
  };
  totals: {
    totalArticles: number;
    totalStockValue: number;
    totalValueAtSale: number;
    totalPotentialProfit: number;
  };
  calculatedAt: Date;
  config: StockClassificationConfig;
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

