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
/**
 * Pure function: classifies articles by revenue using Pareto (80/95/100) thresholds.
 * Exported for unit testing without DB dependency.
 */
export function classifyByRevenue(articleRevenues: ArticleRevenue[]): ABCResult[] {
  if (articleRevenues.length === 0) return [];

  const sorted = [...articleRevenues].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const totalRevenue = sorted.reduce((sum, item) => sum + item.totalRevenue, 0);

  const results: ABCResult[] = [];
  let cumulativeRevenue = 0;

  for (const item of sorted) {
    cumulativeRevenue += item.totalRevenue;
    const revenuePercentage = (item.totalRevenue / totalRevenue) * 100;
    const cumulativePercentage = (cumulativeRevenue / totalRevenue) * 100;

    let abcClass: ABCClass;
    if (cumulativePercentage <= 80) {
      abcClass = 'A';
    } else if (cumulativePercentage <= 95) {
      abcClass = 'B';
    } else {
      abcClass = 'C';
    }

    results.push({
      articleId: item.articleId,
      abcClass,
      revenue: item.totalRevenue,
      revenuePercentage,
      cumulativePercentage,
    });
  }

  return results;
}

export async function calculateABCClassification(
  forceRefresh = false
): Promise<Map<string, ABCClass>> {
  const now = Date.now();
  if (
    !forceRefresh &&
    abcCache.data &&
    abcCache.timestamp &&
    now - abcCache.timestamp < CACHE_DURATION
  ) {
    return abcCache.data;
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const salesData = await prisma.invoice_items.groupBy({
    by: ['article_id'],
    where: {
      invoices: {
        is_printed: true,
        is_cancelled: false,
        invoice_date: { gte: oneYearAgo },
      },
    },
    _sum: { line_total: true },
  });

  const articleRevenues: ArticleRevenue[] = salesData
    .map((item) => ({
      articleId: item.article_id,
      totalRevenue: Number(item._sum.line_total || 0),
    }))
    .filter((item) => item.totalRevenue > 0);

  const abcResults = classifyByRevenue(articleRevenues);

  const abcMap = new Map<string, ABCClass>();
  for (const result of abcResults) {
    abcMap.set(result.articleId.toString(), result.abcClass);
  }

  abcCache = { data: abcMap, timestamp: now };
  return abcMap;
}

/**
 * Obtiene la clase ABC de un artículo específico
 * @param articleId - ID del artículo
 * @returns Clase ABC o null si no tiene ventas
 */
export async function getArticleABCClass(articleId: bigint | number): Promise<ABCClass | null> {
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
