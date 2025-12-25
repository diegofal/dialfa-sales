import { prisma } from '@/lib/db';

export interface SalesTrendData {
  month: string; // Format: "2024-01", "2024-02", etc.
  sales: number; // Total quantity sold
  revenue: number; // Total revenue
}

export interface ArticleSalesTrend {
  articleId: string;
  trend: number[]; // Array of sales quantities for last N months
  labels: string[]; // Month labels
  totalSales: number;
}

let salesTrendCache: {
  data: Map<string, Map<number, number[]>> | null; // Map de articleId -> Map de months -> trend data
  labels: Map<number, string[]> | null; // Map de months -> labels
  timestamp: number | null;
} = {
  data: null,
  labels: null,
  timestamp: null,
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas en ms

/**
 * Calcula las tendencias de ventas mensuales para todos los artículos
 * Retorna un mapa de articleId -> array de ventas por mes
 * 
 * @param monthsToShow - Cantidad de meses a mostrar (por defecto 12)
 * @param forceRefresh - Si true, recalcula ignorando el caché
 * @returns Map con articleId -> array de cantidades vendidas por mes
 */
export async function calculateSalesTrends(
  monthsToShow: number = 12,
  forceRefresh = false
): Promise<{ data: Map<string, number[]>; labels: string[] }> {
  // Verificar caché para estos meses específicos
  const now = Date.now();
  if (
    !forceRefresh &&
    salesTrendCache.data &&
    salesTrendCache.labels &&
    salesTrendCache.timestamp &&
    now - salesTrendCache.timestamp < CACHE_DURATION
  ) {
    const cachedDataForMonths = salesTrendCache.data.get(monthsToShow);
    const cachedLabels = salesTrendCache.labels.get(monthsToShow);
    
    if (cachedDataForMonths && cachedLabels) {
      console.log(`Sales Trends: Using cached data for ${monthsToShow} months`);
      return {
        data: cachedDataForMonths,
        labels: cachedLabels,
      };
    }
  }

  console.log(`Sales Trends: Calculating fresh data for ${monthsToShow} months...`);
  const startTime = Date.now();

  try {
    // 1. Generar array de los últimos N meses
    const monthsArray: { year: number; month: number; label: string }[] = [];
    const today = new Date();
    
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      monthsArray.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1, // 1-12
        label: date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      });
    }

    // 2. Obtener ventas por artículo y mes
    const salesByMonth = new Map<string, Map<string, number>>();
    
    for (const monthData of monthsArray) {
      const startDate = new Date(monthData.year, monthData.month - 1, 1);
      const endDate = new Date(monthData.year, monthData.month, 0, 23, 59, 59);

      const monthKey = `${monthData.year}-${monthData.month.toString().padStart(2, '0')}`;

      // Query para obtener ventas del mes
      const salesData = await prisma.invoice_items.groupBy({
        by: ['article_id'],
        where: {
          invoices: {
            is_printed: true,
            is_cancelled: false,
            invoice_date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        _sum: {
          quantity: true,
        },
      });

      // Almacenar en estructura de datos
      for (const item of salesData) {
        const articleId = item.article_id.toString();
        const quantity = Number(item._sum.quantity || 0);

        if (!salesByMonth.has(articleId)) {
          salesByMonth.set(articleId, new Map());
        }

        salesByMonth.get(articleId)!.set(monthKey, quantity);
      }
    }

    // 3. Convertir a formato de array para cada artículo
    const trendsMap = new Map<string, number[]>();

    for (const [articleId, monthsMap] of salesByMonth.entries()) {
      const trend = monthsArray.map((monthData) => {
        const monthKey = `${monthData.year}-${monthData.month.toString().padStart(2, '0')}`;
        return monthsMap.get(monthKey) || 0;
      });

      trendsMap.set(articleId, trend);
    }

    const labels = monthsArray.map((m) => m.label);

    // 4. Actualizar caché
    if (!salesTrendCache.data) {
      salesTrendCache.data = new Map();
    }
    if (!salesTrendCache.labels) {
      salesTrendCache.labels = new Map();
    }
    
    salesTrendCache.data.set(monthsToShow, trendsMap);
    salesTrendCache.labels.set(monthsToShow, labels);
    salesTrendCache.timestamp = now;

    const duration = Date.now() - startTime;
    console.log(
      `Sales Trends: Calculated for ${trendsMap.size} articles (${monthsToShow} months) in ${duration}ms`
    );
    console.log(`  - Months: ${labels.join(', ')}`);

    return {
      data: trendsMap,
      labels,
    };
  } catch (error) {
    console.error('Error calculating sales trends:', error);
    throw error;
  }
}

/**
 * Obtiene la tendencia de ventas de un artículo específico
 * @param articleId - ID del artículo
 * @param monthsToShow - Cantidad de meses a mostrar
 * @returns Array de ventas por mes o null si no tiene ventas
 */
export async function getArticleSalesTrend(
  articleId: bigint | number,
  monthsToShow: number = 12
): Promise<ArticleSalesTrend | null> {
  const { data, labels } = await calculateSalesTrends(monthsToShow);
  const trend = data.get(articleId.toString());

  if (!trend) {
    return null;
  }

  const totalSales = trend.reduce((sum, val) => sum + val, 0);

  return {
    articleId: articleId.toString(),
    trend,
    labels,
    totalSales,
  };
}

/**
 * Fuerza el recálculo de las tendencias de ventas (útil para admin)
 */
export async function refreshSalesTrends(monthsToShow: number = 12): Promise<void> {
  await calculateSalesTrends(monthsToShow, true);
}

/**
 * Obtiene información sobre el estado del caché de tendencias
 */
export function getSalesTrendsCacheInfo(monthsToShow: number = 12) {
  if (!salesTrendCache.timestamp) {
    return {
      isCached: false,
      age: null,
      ageHours: null,
      articlesCount: 0,
      expiresIn: null,
      monthsTracked: monthsToShow,
    };
  }

  const age = Date.now() - salesTrendCache.timestamp;
  const expiresIn = CACHE_DURATION - age;
  const cachedData = salesTrendCache.data?.get(monthsToShow);

  return {
    isCached: !!cachedData,
    age,
    ageHours: (age / (1000 * 60 * 60)).toFixed(2),
    articlesCount: cachedData?.size || 0,
    expiresIn: expiresIn > 0 ? expiresIn : 0,
    expiresInHours:
      expiresIn > 0 ? (expiresIn / (1000 * 60 * 60)).toFixed(2) : 0,
    monthsTracked: monthsToShow,
    labels: salesTrendCache.labels?.get(monthsToShow) || [],
  };
}

