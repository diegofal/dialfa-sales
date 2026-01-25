import { prisma } from '@/lib/db';
import { calculateTrendDirection } from '@/lib/utils/salesCalculations';
import {
  ClientStatus,
  ClientClassificationConfig,
  ClientClassificationSummary,
  ClientClassificationMetrics,
  ClientClassificationCacheInfo,
} from '@/types/clientClassification';

const clientClassificationCache: {
  data: ClientClassificationSummary | null;
  timestamp: number | null;
  config: ClientClassificationConfig | null;
} = {
  data: null,
  timestamp: null,
  config: null,
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

const DEFAULT_CONFIG: ClientClassificationConfig = {
  activeThresholdDays: 90,
  slowMovingThresholdDays: 180,
  inactiveThresholdDays: 365,
  minPurchasesPerMonth: 1, // 1 compra/mes mínimo
  trendMonths: 12,
};

/**
 * Calcula la clasificación de todos los clientes según su actividad de compra
 */
export async function calculateClientClassification(
  config: Partial<ClientClassificationConfig> = {},
  forceRefresh = false
): Promise<ClientClassificationSummary> {
  const finalConfig: ClientClassificationConfig = { ...DEFAULT_CONFIG, ...config };

  const now = Date.now();
  if (
    !forceRefresh &&
    clientClassificationCache.data &&
    clientClassificationCache.timestamp &&
    clientClassificationCache.config &&
    now - clientClassificationCache.timestamp < CACHE_DURATION &&
    configsMatch(clientClassificationCache.config, finalConfig)
  ) {
    return clientClassificationCache.data;
  }

  // 1. Obtener todos los clientes activos
  const clients = await prisma.clients.findMany({
    where: {
      deleted_at: null,
    },
    select: {
      id: true,
      code: true,
      business_name: true,
    },
  });

  // 2. Calcular fecha límite para el período de análisis
  const periodStartDate = new Date();
  periodStartDate.setMonth(periodStartDate.getMonth() - finalConfig.trendMonths);

  // 3. Obtener todas las facturas del período por cliente
  const invoicesData = await prisma.$queryRaw<
    Array<{
      client_id: bigint;
      total_invoices: bigint;
      total_amount: number;
      last_invoice_date: Date | null;
      first_invoice_date: Date | null;
    }>
  >`
      SELECT 
        so.client_id,
        COUNT(DISTINCT i.id) as total_invoices,
        SUM(i.total_amount) as total_amount,
        MAX(i.invoice_date) as last_invoice_date,
        MIN(i.invoice_date) as first_invoice_date
      FROM invoices i
      INNER JOIN sales_orders so ON i.sales_order_id = so.id
      WHERE i.is_printed = true
        AND i.is_cancelled = false
        AND i.deleted_at IS NULL
        AND so.deleted_at IS NULL
        AND i.invoice_date >= ${periodStartDate}
      GROUP BY so.client_id
    `;

  // 4. Obtener facturación histórica total (para CLV - Customer Lifetime Value)
  // Y la última fecha de compra (sin restricción de período)
  const historicalData = await prisma.$queryRaw<
    Array<{
      client_id: bigint;
      lifetime_total: number;
      last_purchase_date: Date | null;
    }>
  >`
      SELECT 
        so.client_id,
        SUM(i.total_amount) as lifetime_total,
        MAX(i.invoice_date) as last_purchase_date
      FROM invoices i
      INNER JOIN sales_orders so ON i.sales_order_id = so.id
      WHERE i.is_printed = true
        AND i.is_cancelled = false
        AND i.deleted_at IS NULL
        AND so.deleted_at IS NULL
      GROUP BY so.client_id
    `;

  // 5. Obtener tendencias mensuales
  const trendsData = await calculateMonthlyTrends(finalConfig.trendMonths);

  // 6. Crear mapas para acceso rápido
  const invoicesMap = new Map(invoicesData.map((d) => [d.client_id.toString(), d]));
  const historicalMap = new Map(historicalData.map((d) => [d.client_id.toString(), d]));

  // 7. Clasificar cada cliente
  const clientsMetrics: ClientClassificationMetrics[] = [];
  const currentDate = new Date();

  for (const client of clients) {
    const clientId = client.id.toString();
    const invoiceData = invoicesMap.get(clientId);
    const historical = historicalMap.get(clientId);
    const trend = trendsData.get(clientId) || [];

    const metrics = classifyClient(
      client,
      invoiceData,
      historical,
      trend,
      currentDate,
      finalConfig
    );

    clientsMetrics.push(metrics);
  }

  // 8. Agrupar por status
  const byStatus: ClientClassificationSummary['byStatus'] = {
    [ClientStatus.ACTIVE]: { count: 0, totalRevenue: 0, avgRevenuePerClient: 0, clients: [] },
    [ClientStatus.SLOW_MOVING]: {
      count: 0,
      totalRevenue: 0,
      avgRevenuePerClient: 0,
      clients: [],
    },
    [ClientStatus.INACTIVE]: { count: 0, totalRevenue: 0, avgRevenuePerClient: 0, clients: [] },
    [ClientStatus.NEVER_PURCHASED]: {
      count: 0,
      totalRevenue: 0,
      avgRevenuePerClient: 0,
      clients: [],
    },
  };

  for (const metrics of clientsMetrics) {
    const group = byStatus[metrics.status];
    group.clients.push(metrics);
    group.count++;
    group.totalRevenue += metrics.totalRevenueInPeriod;
  }

  // Calcular promedios
  for (const status of Object.values(ClientStatus)) {
    const group = byStatus[status];
    group.avgRevenuePerClient = group.count > 0 ? group.totalRevenue / group.count : 0;
  }

  // 9. Calcular totales
  const totals = {
    totalClients: clientsMetrics.length,
    totalRevenue: clientsMetrics.reduce((sum, m) => sum + m.totalRevenueInPeriod, 0),
    avgRevenuePerClient: 0,
  };
  totals.avgRevenuePerClient =
    totals.totalClients > 0 ? totals.totalRevenue / totals.totalClients : 0;

  const summary: ClientClassificationSummary = {
    byStatus,
    totals,
    calculatedAt: new Date(),
    config: finalConfig,
  };

  // 10. Actualizar caché
  clientClassificationCache.data = summary;
  clientClassificationCache.timestamp = now;
  clientClassificationCache.config = finalConfig;

  return summary;
}

/**
 * Clasifica un cliente individual
 */
export function classifyClient(
  client: { id: bigint; code: string; business_name: string },
  invoiceData:
    | { total_invoices: bigint; total_amount: number; last_invoice_date: Date | null }
    | undefined,
  historicalData: { lifetime_total: number; last_purchase_date: Date | null } | undefined,
  trend: number[],
  now: Date,
  config: ClientClassificationConfig
): ClientClassificationMetrics {
  const clientId = client.id.toString();

  // Datos básicos del período
  const totalPurchases = invoiceData ? Number(invoiceData.total_invoices) : 0;
  const totalRevenue = invoiceData?.total_amount || 0;

  // Datos históricos (toda la vida del cliente)
  const lifetimeValue = historicalData?.lifetime_total || 0;
  const lastPurchaseDate = historicalData?.last_purchase_date || null;

  // Calcular días desde última compra y frecuencia de compras
  let daysSinceLastPurchase: number | null = null;
  if (lastPurchaseDate) {
    const diffTime = now.getTime() - lastPurchaseDate.getTime();
    daysSinceLastPurchase = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // Calcular frecuencia mensual de compras
  const purchaseFrequency = totalPurchases / config.trendMonths;

  // Determinar status basado en RECENCIA y FRECUENCIA
  let status: ClientStatus;
  if (!lastPurchaseDate) {
    // Nunca compró
    status = ClientStatus.NEVER_PURCHASED;
  } else if (
    daysSinceLastPurchase !== null &&
    daysSinceLastPurchase <= config.activeThresholdDays
  ) {
    // Compró recientemente - verificar frecuencia
    if (purchaseFrequency >= config.minPurchasesPerMonth) {
      status = ClientStatus.ACTIVE; // Compra frecuente y reciente
    } else {
      status = ClientStatus.SLOW_MOVING; // Compra reciente pero poco frecuente
    }
  } else if (
    daysSinceLastPurchase !== null &&
    daysSinceLastPurchase <= config.slowMovingThresholdDays
  ) {
    // No tan reciente - siempre es lento o inactivo
    status = ClientStatus.SLOW_MOVING;
  } else {
    // Hace mucho que no compra
    status = ClientStatus.INACTIVE;
  }

  // Calcular métricas
  const avgMonthlyRevenue = totalRevenue / config.trendMonths;
  const averageOrderValue = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;
  // purchaseFrequency ya calculado arriba

  // Dirección de tendencia
  const trendDirection = calculateTrendDirection(trend);

  // Scoring RFM (Recency, Frequency, Monetary)
  const recencyScore = calculateRecencyScore(daysSinceLastPurchase, config);
  const frequencyScore = calculateFrequencyScore(totalPurchases, config);
  const monetaryScore = calculateMonetaryScore(totalRevenue);
  const rfmScore = (recencyScore + frequencyScore + monetaryScore) / 3;

  return {
    clientId,
    clientCode: client.code,
    clientBusinessName: client.business_name,
    status,
    daysSinceLastPurchase,
    lastPurchaseDate,
    avgMonthlyRevenue,
    purchasesTrend: trend,
    trendDirection,
    totalRevenueInPeriod: totalRevenue,
    totalPurchasesInPeriod: totalPurchases,
    averageOrderValue,
    purchaseFrequency,
    customerLifetimeValue: lifetimeValue,
    recencyScore,
    frequencyScore,
    monetaryScore,
    rfmScore,
  };
}

/**
 * Calcula tendencias mensuales de facturación por cliente
 */
async function calculateMonthlyTrends(months: number): Promise<Map<string, number[]>> {
  const monthsArray: { year: number; month: number }[] = [];
  const today = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthsArray.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
    });
  }

  const trendsMap = new Map<string, number[]>();

  for (const monthData of monthsArray) {
    const startDate = new Date(monthData.year, monthData.month - 1, 1);
    const endDate = new Date(monthData.year, monthData.month, 0, 23, 59, 59);

    const monthlyData = await prisma.$queryRaw<
      Array<{
        client_id: bigint;
        total_amount: number;
      }>
    >`
      SELECT 
        so.client_id,
        SUM(i.total_amount) as total_amount
      FROM invoices i
      INNER JOIN sales_orders so ON i.sales_order_id = so.id
      WHERE i.is_printed = true
        AND i.is_cancelled = false
        AND i.invoice_date >= ${startDate}
        AND i.invoice_date <= ${endDate}
        AND so.deleted_at IS NULL
        AND i.deleted_at IS NULL
      GROUP BY so.client_id
    `;

    for (const item of monthlyData) {
      const clientId = item.client_id.toString();
      if (!trendsMap.has(clientId)) {
        trendsMap.set(clientId, Array(months).fill(0));
      }
      const trend = trendsMap.get(clientId)!;
      const monthIndex = monthsArray.findIndex(
        (m) => m.year === monthData.year && m.month === monthData.month
      );
      trend[monthIndex] = Number(item.total_amount);
    }
  }

  return trendsMap;
}

/**
 * Calcula score de recencia (0-100)
 */
export function calculateRecencyScore(
  days: number | null,
  config: ClientClassificationConfig
): number {
  if (days === null) return 0;
  if (days <= config.activeThresholdDays) return 100;
  if (days >= config.inactiveThresholdDays) return 0;

  // Interpolación lineal
  return Math.max(
    0,
    100 -
      ((days - config.activeThresholdDays) /
        (config.inactiveThresholdDays - config.activeThresholdDays)) *
        100
  );
}

/**
 * Calcula score de frecuencia (0-100)
 * Basado en compras mensuales promedio
 */
function calculateFrequencyScore(purchases: number, config: ClientClassificationConfig): number {
  if (purchases === 0) return 0;

  // Calcular frecuencia real (compras/mes)
  const actualPurchasesPerMonth = purchases / config.trendMonths;

  // Un cliente "excelente" compra al doble de la frecuencia mínima
  const targetPurchasesPerMonth = config.minPurchasesPerMonth * 2;

  if (actualPurchasesPerMonth >= targetPurchasesPerMonth) return 100;

  return Math.min(100, (actualPurchasesPerMonth / targetPurchasesPerMonth) * 100);
}

/**
 * Calcula score monetario (0-100)
 */
function calculateMonetaryScore(revenue: number): number {
  // Normalizar usando logaritmo para manejar rangos amplios
  if (revenue === 0) return 0;

  // Asumimos que $1M ARS es un cliente "perfecto" (score 100)
  const target = 1000000;
  return Math.min(100, (revenue / target) * 100);
}

/**
 * Compara dos configuraciones
 */
function configsMatch(a: ClientClassificationConfig, b: ClientClassificationConfig): boolean {
  return (
    a.activeThresholdDays === b.activeThresholdDays &&
    a.slowMovingThresholdDays === b.slowMovingThresholdDays &&
    a.inactiveThresholdDays === b.inactiveThresholdDays &&
    a.minPurchasesPerMonth === b.minPurchasesPerMonth &&
    a.trendMonths === b.trendMonths
  );
}

/**
 * Obtiene información sobre el caché
 */
export function getClientClassificationCacheInfo(): ClientClassificationCacheInfo {
  if (!clientClassificationCache.timestamp) {
    return {
      isCached: false,
      age: null,
      ageHours: null,
      expiresIn: null,
      expiresInHours: null,
      calculatedAt: null,
      clientsCount: 0,
      config: null,
    };
  }

  const age = Date.now() - clientClassificationCache.timestamp;
  const expiresIn = CACHE_DURATION - age;

  return {
    isCached: true,
    age,
    ageHours: (age / (1000 * 60 * 60)).toFixed(2),
    expiresIn: expiresIn > 0 ? expiresIn : 0,
    expiresInHours: expiresIn > 0 ? (expiresIn / (1000 * 60 * 60)).toFixed(2) : '0',
    calculatedAt: clientClassificationCache.data?.calculatedAt || null,
    clientsCount: clientClassificationCache.data?.totals.totalClients || 0,
    config: clientClassificationCache.config,
  };
}

/**
 * Limpia el caché (útil para testing)
 */
export function clearClientClassificationCache(): void {
  clientClassificationCache.data = null;
  clientClassificationCache.timestamp = null;
  clientClassificationCache.config = null;
}
