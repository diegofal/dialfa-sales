export enum StockStatus {
  ACTIVE = 'active',
  SLOW_MOVING = 'slow_moving',
  DEAD_STOCK = 'dead_stock',
  NEVER_SOLD = 'never_sold',
}

export interface StockClassificationConfig {
  /** Recencia máxima (días) para que un artículo califique como ACTIVE. */
  activeThresholdDays: number; // Default: 90

  /**
   * @deprecated No se usa en la regla de clasificación nueva. Se mantiene en el
   * tipo para retrocompatibilidad de la UI/API. La frontera entre slow y dead
   * la define ahora `minMonthsForLeavingDead` sobre la ventana
   * `deadStockNoActivityWindowMonths`.
   */
  slowMovingThresholdDays: number;

  /**
   * @deprecated Reemplazado por `deadStockNoActivityWindowMonths` (en meses).
   * Se mantiene en el tipo para retrocompatibilidad de la UI/API.
   */
  deadStockThresholdDays: number;

  /**
   * @deprecated Eliminado en favor de la regla de frecuencia
   * (`minMonthsForActive`). Se mantiene en el tipo para retrocompatibilidad
   * de la UI/API.
   */
  minSalesForActive: number;

  /** Meses de tendencia mostrados en gráficos / sparklines. */
  trendMonths: number; // Default: 6
  /** Incluir artículos con stock = 0 en la valorización. */
  includeZeroStock: boolean; // Default: false

  /** Mínimo de meses con ventas en los últimos 3 para calificar como ACTIVE. */
  minMonthsForActive?: number; // Default: 2
  /** Mínimo de meses con ventas en `deadStockNoActivityWindowMonths` para no estar en DEAD. */
  minMonthsForLeavingDead?: number; // Default: 2
  /** Ventana (meses) sobre la que se mide actividad para distinguir dead de no-dead. */
  deadStockNoActivityWindowMonths?: number; // Default: 12
  /**
   * Días consecutivos en `article_status_snapshots` requeridos para confirmar
   * un upgrade (ej: dead→slow, slow→active).
   */
  upgradeConfirmDays?: number; // Default: 7
  /** Días consecutivos requeridos para confirmar un downgrade (ej: active→slow). */
  downgradeConfirmDays?: number; // Default: 14
  /**
   * Si `monthsWithSalesInLast6 >= este valor`, los upgrades saltan la
   * confirmación por historia (escape hatch para reactivaciones claras).
   */
  fastUpgradeMonthsThreshold?: number; // Default: 4
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
  unitCost: number; // Costo unitario CIF = FOB × (1 + CIF%)
  unitCostFob: number; // FOB raw (last_purchase_price)
  lastPurchaseProformaNumber: string | null; // Proforma source of unitCostFob
  lastPurchaseProformaDate: string | null; // ISO date (YYYY-MM-DD)
  cifPercentage: number; // % CIF aplicado
  unitPrice: number; // Precio unitario de venta
  stockValue: number; // stock * unitCost (CIF)
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
