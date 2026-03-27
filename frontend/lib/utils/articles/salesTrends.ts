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

export interface LastSaleDateData {
  articleId: string;
  lastSaleDate: Date | null;
}

const salesTrendCache: {
  data: Map<number, Map<string, number[]>> | null; // Map de months -> (Map de articleId -> trend data)
  labels: Map<number, string[]> | null; // Map de months -> labels
  timestamp: number | null;
} = {
  data: null,
  labels: null,
  timestamp: null,
};

const lastSaleDateCache: {
  data: Map<string, Date | null> | null; // Map de articleId -> last sale date
  timestamp: number | null;
} = {
  data: null,
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
      return {
        data: cachedDataForMonths,
        labels: cachedLabels,
      };
    }
  }

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
      // Usamos sales_order_items como fuente de verdad
      const salesData = await prisma.$queryRaw<
        Array<{
          article_id: bigint;
          total_quantity: number;
        }>
      >`
        SELECT 
          soi.article_id,
          SUM(soi.quantity) as total_quantity
        FROM sales_order_items soi
        INNER JOIN sales_orders so ON soi.sales_order_id = so.id
        INNER JOIN invoices i ON i.sales_order_id = so.id
        WHERE i.is_printed = true
          AND i.is_cancelled = false
          AND i.invoice_date >= ${startDate}
          AND i.invoice_date <= ${endDate}
          AND so.deleted_at IS NULL
          AND i.deleted_at IS NULL
        GROUP BY soi.article_id
      `;

      // Almacenar en estructura de datos
      for (const item of salesData) {
        const articleId = item.article_id.toString();
        const quantity = Number(item.total_quantity || 0);

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

    return {
      data: trendsMap,
      labels,
    };
  } catch (error) {
    throw error;
  }
}

export interface ActiveStockTrendResult {
  /** articleId -> { trend, labels, activeMonths } */
  data: Map<string, { trend: number[]; labels: string[]; activeMonths: number }>;
}

const activeStockCache: {
  data: Map<number, ActiveStockTrendResult> | null;
  timestamp: number | null;
} = {
  data: null,
  timestamp: null,
};

/**
 * Busca en TODA la historia de ventas el mejor período de N meses consecutivos
 * con mayor actividad (más meses con ventas) para cada artículo.
 *
 * Si el mejor período coincide con el período actual (últimos N meses), se omite.
 */
export async function calculateActiveStockTrends(
  monthsToShow: number = 12
): Promise<ActiveStockTrendResult> {
  // Check cache
  const now = Date.now();
  if (
    activeStockCache.data &&
    activeStockCache.timestamp &&
    now - activeStockCache.timestamp < CACHE_DURATION
  ) {
    const cached = activeStockCache.data.get(monthsToShow);
    if (cached) return cached;
  }

  // 1. Get ALL sales grouped by article + month (entire history)
  const allSales = await prisma.$queryRaw<
    Array<{ article_id: bigint; month: string; qty: number }>
  >`
    SELECT
      soi.article_id,
      TO_CHAR(i.invoice_date, 'YYYY-MM') as month,
      SUM(soi.quantity) as qty
    FROM sales_order_items soi
    INNER JOIN sales_orders so ON soi.sales_order_id = so.id
    INNER JOIN invoices i ON i.sales_order_id = so.id
    WHERE i.is_printed = true
      AND i.is_cancelled = false
      AND so.deleted_at IS NULL
      AND i.deleted_at IS NULL
    GROUP BY soi.article_id, TO_CHAR(i.invoice_date, 'YYYY-MM')
    ORDER BY soi.article_id, month
  `;

  // 2. Group by article
  const articleSales = new Map<string, Map<string, number>>();
  for (const row of allSales) {
    const artId = row.article_id.toString();
    if (!articleSales.has(artId)) articleSales.set(artId, new Map());
    articleSales.get(artId)!.set(row.month, Number(row.qty));
  }

  // 3. Get current period labels for comparison
  const { labels: currentLabels } = await calculateSalesTrends(monthsToShow);

  // Helper: generate consecutive month keys from a start year/month
  function generateMonthKeys(startYear: number, startMonth: number, count: number): string[] {
    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(startYear, startMonth - 1 + i, 1);
      keys.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
    }
    return keys;
  }

  function monthKeyToLabel(key: string): string {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
  }

  const result = new Map<string, { trend: number[]; labels: string[]; activeMonths: number }>();

  for (const [articleId, salesByMonth] of articleSales.entries()) {
    const months = Array.from(salesByMonth.keys()).sort();
    if (months.length === 0) continue;

    // Parse first and last month
    const [firstY, firstM] = months[0].split('-').map(Number);
    const [lastY, lastM] = months[months.length - 1].split('-').map(Number);

    // Total months span from first to last sale
    const totalSpan = (lastY - firstY) * 12 + (lastM - firstM) + 1;

    // If history is shorter than window, skip
    if (totalSpan < monthsToShow) continue;

    // Sliding window: find the window of monthsToShow with most active months
    let bestScore = 0;
    let bestQty = 0;
    let bestStartY = firstY;
    let bestStartM = firstM;

    const windowCount = totalSpan - monthsToShow + 1;
    for (let w = 0; w < windowCount; w++) {
      const d = new Date(firstY, firstM - 1 + w, 1);
      const wY = d.getFullYear();
      const wM = d.getMonth() + 1;
      const windowKeys = generateMonthKeys(wY, wM, monthsToShow);

      let activeCount = 0;
      let totalQty = 0;
      for (const key of windowKeys) {
        const qty = salesByMonth.get(key) || 0;
        if (qty > 0) activeCount++;
        totalQty += qty;
      }

      if (activeCount > bestScore || (activeCount === bestScore && totalQty > bestQty)) {
        bestScore = activeCount;
        bestQty = totalQty;
        bestStartY = wY;
        bestStartM = wM;
      }
    }

    // Build the best window trend
    const bestKeys = generateMonthKeys(bestStartY, bestStartM, monthsToShow);
    const bestLabels = bestKeys.map(monthKeyToLabel);

    // Skip if the best window IS the current period
    if (
      bestLabels[0] === currentLabels[0] &&
      bestLabels[bestLabels.length - 1] === currentLabels[currentLabels.length - 1]
    ) {
      continue;
    }

    const trend = bestKeys.map((k) => salesByMonth.get(k) || 0);

    result.set(articleId, {
      trend,
      labels: bestLabels,
      activeMonths: bestScore,
    });
  }

  const resultObj: ActiveStockTrendResult = { data: result };

  // Update cache
  if (!activeStockCache.data) activeStockCache.data = new Map();
  activeStockCache.data.set(monthsToShow, resultObj);
  activeStockCache.timestamp = now;

  return resultObj;
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
    expiresInHours: expiresIn > 0 ? (expiresIn / (1000 * 60 * 60)).toFixed(2) : 0,
    monthsTracked: monthsToShow,
    labels: salesTrendCache.labels?.get(monthsToShow) || [],
  };
}

/**
 * Calcula la fecha de la última venta para todos los artículos
 * Retorna un mapa de articleId -> última fecha de venta (o null si nunca se vendió)
 */
export async function calculateLastSaleDates(
  forceRefresh = false
): Promise<Map<string, Date | null>> {
  // Verificar caché
  const now = Date.now();
  if (
    !forceRefresh &&
    lastSaleDateCache.data &&
    lastSaleDateCache.timestamp &&
    now - lastSaleDateCache.timestamp < CACHE_DURATION
  ) {
    return lastSaleDateCache.data;
  }

  try {
    // Obtener la última fecha de venta por artículo
    // Los artículos vendidos están en sales_order_items, no en invoice_items
    // Hacemos JOIN: sales_order_items -> sales_orders -> invoices
    const lastSales = await prisma.$queryRaw<
      Array<{
        article_id: bigint;
        last_sale_date: Date | null;
      }>
    >`
      SELECT 
        soi.article_id,
        MAX(i.invoice_date) as last_sale_date
      FROM sales_order_items soi
      INNER JOIN sales_orders so ON soi.sales_order_id = so.id
      INNER JOIN invoices i ON i.sales_order_id = so.id
      WHERE i.is_printed = true 
        AND i.is_cancelled = false
        AND i.deleted_at IS NULL
        AND so.deleted_at IS NULL
      GROUP BY soi.article_id
    `;

    // Convertir a Map
    const lastSaleDateMap = new Map<string, Date | null>();
    lastSales.forEach((row) => {
      lastSaleDateMap.set(row.article_id.toString(), row.last_sale_date);
    });

    // Actualizar caché
    lastSaleDateCache.data = lastSaleDateMap;
    lastSaleDateCache.timestamp = now;

    return lastSaleDateMap;
  } catch (error) {
    throw error;
  }
}

/**
 * Fuerza el recálculo de las últimas fechas de venta
 */
export async function refreshLastSaleDates(): Promise<void> {
  await calculateLastSaleDates(true);
}
