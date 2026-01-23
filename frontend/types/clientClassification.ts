export enum ClientStatus {
  ACTIVE = 'active',
  SLOW_MOVING = 'slow_moving',
  INACTIVE = 'inactive',
  NEVER_PURCHASED = 'never_purchased',
}

export interface ClientClassificationConfig {
  activeThresholdDays: number; // Default: 90
  slowMovingThresholdDays: number; // Default: 180
  inactiveThresholdDays: number; // Default: 365
  minPurchasesPerMonth: number; // Default: 1 (compra/mes)
  trendMonths: number; // Default: 12
}

export interface ClientClassificationMetrics {
  clientId: string;
  clientCode: string;
  clientBusinessName: string;
  status: ClientStatus;

  // Métricas temporales
  daysSinceLastPurchase: number | null;
  lastPurchaseDate: Date | null;

  // Métricas de compras
  avgMonthlyRevenue: number;
  purchasesTrend: number[];
  trendDirection: 'increasing' | 'stable' | 'decreasing' | 'none';
  totalRevenueInPeriod: number;
  totalPurchasesInPeriod: number;

  // Métricas calculadas
  averageOrderValue: number; // Valor promedio de cada compra
  purchaseFrequency: number; // Compras por mes
  customerLifetimeValue: number; // Valor total histórico del cliente

  // Scoring
  recencyScore: number; // 0-100 basado en última compra
  frequencyScore: number; // 0-100 basado en frecuencia
  monetaryScore: number; // 0-100 basado en volumen
  rfmScore: number; // Score RFM combinado (0-100)
}

export interface ClientClassificationSummary {
  byStatus: {
    [key in ClientStatus]: {
      count: number;
      totalRevenue: number;
      avgRevenuePerClient: number;
      clients: ClientClassificationMetrics[];
    };
  };
  totals: {
    totalClients: number;
    totalRevenue: number;
    avgRevenuePerClient: number;
  };
  calculatedAt: Date;
  config: ClientClassificationConfig;
  cacheInfo?: ClientClassificationCacheInfo;
}

export interface ClientClassificationCacheInfo {
  isCached: boolean;
  age: number | null;
  ageHours: string | null;
  expiresIn: number | null;
  expiresInHours: string | null;
  calculatedAt: Date | null;
  clientsCount: number;
  config: ClientClassificationConfig | null;
}
