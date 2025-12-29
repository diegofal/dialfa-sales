import { prisma } from '@/lib/db';

const clientSalesTrendCache: {
  data: Map<number, Map<string, number[]>> | null; // Map de months -> (Map de clientId -> trend data)
  labels: Map<number, string[]> | null; // Map de months -> labels
  timestamp: number | null;
} = {
  data: null,
  labels: null,
  timestamp: null,
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas en ms

/**
 * Calcula las tendencias de facturación mensuales para todos los clientes
 * Retorna un mapa de clientId -> array de facturación por mes
 * 
 * @param monthsToShow - Cantidad de meses a mostrar (por defecto 12)
 * @param forceRefresh - Si true, recalcula ignorando el caché
 * @returns Map con clientId -> array de montos facturados por mes
 */
export async function calculateClientSalesTrends(
  monthsToShow: number = 12,
  forceRefresh = false
): Promise<{ data: Map<string, number[]>; labels: string[] }> {
  // Verificar caché para estos meses específicos
  const now = Date.now();
  if (
    !forceRefresh &&
    clientSalesTrendCache.data &&
    clientSalesTrendCache.labels &&
    clientSalesTrendCache.timestamp &&
    now - clientSalesTrendCache.timestamp < CACHE_DURATION
  ) {
    const cachedDataForMonths = clientSalesTrendCache.data.get(monthsToShow);
    const cachedLabels = clientSalesTrendCache.labels.get(monthsToShow);
    
    if (cachedDataForMonths && cachedLabels) {
      console.log(`Client Sales Trends: Using cached data for ${monthsToShow} months`);
      return {
        data: cachedDataForMonths,
        labels: cachedLabels,
      };
    }
  }

  console.log(`Client Sales Trends: Calculating fresh data for ${monthsToShow} months...`);
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

    // 2. Obtener facturación por cliente y mes
    const salesByMonth = new Map<string, Map<string, number>>();
    
    for (const monthData of monthsArray) {
      const startDate = new Date(monthData.year, monthData.month - 1, 1);
      const endDate = new Date(monthData.year, monthData.month, 0, 23, 59, 59);

      const monthKey = `${monthData.year}-${monthData.month.toString().padStart(2, '0')}`;

      // Query para obtener facturación del mes por cliente
      // Obtenemos el total_amount de las facturas agrupadas por cliente
      const salesData = await prisma.$queryRaw<Array<{
        client_id: bigint;
        total_amount: number;
      }>>`
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

      // Almacenar en estructura de datos
      for (const item of salesData) {
        const clientId = item.client_id.toString();
        const amount = Number(item.total_amount || 0);

        if (!salesByMonth.has(clientId)) {
          salesByMonth.set(clientId, new Map());
        }

        salesByMonth.get(clientId)!.set(monthKey, amount);
      }
    }

    // 3. Convertir a formato de array para cada cliente
    const trendsMap = new Map<string, number[]>();

    for (const [clientId, monthsMap] of salesByMonth.entries()) {
      const trend = monthsArray.map((monthData) => {
        const monthKey = `${monthData.year}-${monthData.month.toString().padStart(2, '0')}`;
        return monthsMap.get(monthKey) || 0;
      });

      trendsMap.set(clientId, trend);
    }

    const labels = monthsArray.map((m) => m.label);

    // 4. Actualizar caché
    if (!clientSalesTrendCache.data) {
      clientSalesTrendCache.data = new Map();
    }
    if (!clientSalesTrendCache.labels) {
      clientSalesTrendCache.labels = new Map();
    }
    
    clientSalesTrendCache.data.set(monthsToShow, trendsMap);
    clientSalesTrendCache.labels.set(monthsToShow, labels);
    clientSalesTrendCache.timestamp = now;

    const duration = Date.now() - startTime;
    console.log(
      `Client Sales Trends: Calculated for ${trendsMap.size} clients (${monthsToShow} months) in ${duration}ms`
    );
    console.log(`  - Months: ${labels.join(', ')}`);

    return {
      data: trendsMap,
      labels,
    };
  } catch (error) {
    console.error('Error calculating client sales trends:', error);
    throw error;
  }
}

/**
 * Fuerza el recálculo de las tendencias de facturación de clientes
 */
export async function refreshClientSalesTrends(monthsToShow: number = 12): Promise<void> {
  await calculateClientSalesTrends(monthsToShow, true);
}

/**
 * Obtiene información sobre el estado del caché de tendencias de clientes
 */
export function getClientSalesTrendsCacheInfo(monthsToShow: number = 12) {
  if (!clientSalesTrendCache.timestamp) {
    return {
      isCached: false,
      age: null,
      ageHours: null,
      clientsCount: 0,
      expiresIn: null,
      monthsTracked: monthsToShow,
    };
  }

  const age = Date.now() - clientSalesTrendCache.timestamp;
  const expiresIn = CACHE_DURATION - age;
  const cachedData = clientSalesTrendCache.data?.get(monthsToShow);

  return {
    isCached: !!cachedData,
    age,
    ageHours: (age / (1000 * 60 * 60)).toFixed(2),
    clientsCount: cachedData?.size || 0,
    expiresIn: expiresIn > 0 ? expiresIn : 0,
    expiresInHours:
      expiresIn > 0 ? (expiresIn / (1000 * 60 * 60)).toFixed(2) : 0,
    monthsTracked: monthsToShow,
    labels: clientSalesTrendCache.labels?.get(monthsToShow) || [],
  };
}


