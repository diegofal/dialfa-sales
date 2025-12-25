import { prisma } from '@/lib/db';

export type ABCClass = 'A' | 'B' | 'C';

interface ArticleRevenue {
  articleId: bigint;
  totalRevenue: number;
}

interface ABCResult {
  articleId: bigint;
  abcClass: ABCClass;
  revenue: number;
  revenuePercentage: number;
  cumulativePercentage: number;
}

// Caché en memoria simple
// En producción: considerar Redis para múltiples instancias
let abcCache: {
  data: Map<string, ABCClass> | null;
  timestamp: number | null;
} = {
  data: null,
  timestamp: null,
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas en ms

/**
 * Calcula la clasificación ABC (Pareto) para todos los artículos
 * basándose en las ventas de los últimos 365 días de facturas impresas
 * 
 * Clasificación:
 * - Clase A: Productos que representan el 80% de los ingresos
 * - Clase B: Productos que representan del 80% al 95% de los ingresos
 * - Clase C: Productos que representan del 95% al 100% de los ingresos
 * 
 * @param forceRefresh - Si true, recalcula ignorando el caché
 * @returns Map con articleId -> ABCClass
 */
export async function calculateABCClassification(
  forceRefresh = false
): Promise<Map<string, ABCClass>> {
  // Verificar caché
  const now = Date.now();
  if (
    !forceRefresh &&
    abcCache.data &&
    abcCache.timestamp &&
    now - abcCache.timestamp < CACHE_DURATION
  ) {
    console.log('ABC Classification: Using cached data');
    return abcCache.data;
  }

  console.log('ABC Classification: Calculating fresh data...');
  const startTime = Date.now();

  try {
    // 1. Obtener ventas por artículo de facturas impresas (últimos 365 días)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const salesData = await prisma.invoice_items.groupBy({
      by: ['article_id'],
      where: {
        invoices: {
          is_printed: true,
          is_cancelled: false,
          invoice_date: {
            gte: oneYearAgo,
          },
        },
      },
      _sum: {
        line_total: true,
      },
    });

    // 2. Convertir a array y ordenar por revenue descendente
    const articleRevenues: ArticleRevenue[] = salesData
      .map((item) => ({
        articleId: item.article_id,
        totalRevenue: Number(item._sum.line_total || 0),
      }))
      .filter((item) => item.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Si no hay datos de ventas, retornar mapa vacío
    if (articleRevenues.length === 0) {
      console.log('ABC Classification: No sales data found');
      const emptyMap = new Map<string, ABCClass>();
      abcCache = { data: emptyMap, timestamp: now };
      return emptyMap;
    }

    // 3. Calcular total de ingresos y porcentajes
    const totalRevenue = articleRevenues.reduce(
      (sum, item) => sum + item.totalRevenue,
      0
    );

    const abcResults: ABCResult[] = [];
    let cumulativeRevenue = 0;

    for (const item of articleRevenues) {
      cumulativeRevenue += item.totalRevenue;
      const revenuePercentage = (item.totalRevenue / totalRevenue) * 100;
      const cumulativePercentage = (cumulativeRevenue / totalRevenue) * 100;

      // Clasificar según umbrales de Pareto
      let abcClass: ABCClass;
      if (cumulativePercentage <= 80) {
        abcClass = 'A';
      } else if (cumulativePercentage <= 95) {
        abcClass = 'B';
      } else {
        abcClass = 'C';
      }

      abcResults.push({
        articleId: item.articleId,
        abcClass,
        revenue: item.totalRevenue,
        revenuePercentage,
        cumulativePercentage,
      });
    }

    // 4. Crear Map para acceso rápido
    const abcMap = new Map<string, ABCClass>();
    for (const result of abcResults) {
      abcMap.set(result.articleId.toString(), result.abcClass);
    }

    // 5. Actualizar caché
    abcCache = {
      data: abcMap,
      timestamp: now,
    };

    const duration = Date.now() - startTime;
    console.log(
      `ABC Classification: Calculated for ${abcResults.length} articles in ${duration}ms`
    );
    console.log(
      `  - Class A: ${abcResults.filter((r) => r.abcClass === 'A').length} articles (top 80% revenue)`
    );
    console.log(
      `  - Class B: ${abcResults.filter((r) => r.abcClass === 'B').length} articles (80-95% revenue)`
    );
    console.log(
      `  - Class C: ${abcResults.filter((r) => r.abcClass === 'C').length} articles (95-100% revenue)`
    );

    return abcMap;
  } catch (error) {
    console.error('Error calculating ABC classification:', error);
    throw error;
  }
}

/**
 * Obtiene la clase ABC de un artículo específico
 * @param articleId - ID del artículo
 * @returns Clase ABC o null si no tiene ventas
 */
export async function getArticleABCClass(
  articleId: bigint | number
): Promise<ABCClass | null> {
  const abcMap = await calculateABCClassification();
  return abcMap.get(articleId.toString()) || null;
}

/**
 * Fuerza el recálculo de la clasificación ABC (útil para admin)
 */
export async function refreshABCClassification(): Promise<void> {
  await calculateABCClassification(true);
}

/**
 * Obtiene información sobre el estado del caché
 * @returns Información del caché (edad, cantidad de artículos, etc.)
 */
export function getABCCacheInfo() {
  if (!abcCache.timestamp) {
    return {
      isCached: false,
      age: null,
      ageHours: null,
      articlesCount: 0,
      expiresIn: null,
    };
  }

  const age = Date.now() - abcCache.timestamp;
  const expiresIn = CACHE_DURATION - age;
  
  return {
    isCached: true,
    age,
    ageHours: (age / (1000 * 60 * 60)).toFixed(2),
    articlesCount: abcCache.data?.size || 0,
    expiresIn: expiresIn > 0 ? expiresIn : 0,
    expiresInHours: expiresIn > 0 ? (expiresIn / (1000 * 60 * 60)).toFixed(2) : 0,
  };
}

