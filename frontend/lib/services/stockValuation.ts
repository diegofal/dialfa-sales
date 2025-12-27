import { prisma } from '@/lib/db';
import { calculateSalesTrends, calculateLastSaleDates } from './salesTrends';
import {
  StockStatus,
  StockClassificationConfig,
  StockValuationMetrics,
  StockValuationSummary,
  StockValuationCacheInfo,
} from '@/types/stockValuation';

// Cache en memoria
const stockValuationCache: {
  data: StockValuationSummary | null;
  timestamp: number | null;
  configKey: string | null;
} = {
  data: null,
  timestamp: null,
  configKey: null,
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Genera una clave única para la configuración
 */
function getConfigKey(config: StockClassificationConfig): string {
  return `${config.activeThresholdDays}-${config.slowMovingThresholdDays}-${config.deadStockThresholdDays}-${config.minSalesForActive}-${config.trendMonths}-${config.includeZeroStock}`;
}

/**
 * Calcula la valorización completa de stock para todos los artículos
 */
export async function calculateStockValuation(
  config: Partial<StockClassificationConfig> = {},
  forceRefresh = false
): Promise<StockValuationSummary> {
  
  const fullConfig: StockClassificationConfig = {
    activeThresholdDays: config.activeThresholdDays ?? 90,
    slowMovingThresholdDays: config.slowMovingThresholdDays ?? 180,
    deadStockThresholdDays: config.deadStockThresholdDays ?? 365,
    minSalesForActive: config.minSalesForActive ?? 5,
    trendMonths: config.trendMonths ?? 6,
    includeZeroStock: config.includeZeroStock ?? false,
  };

  const configKey = getConfigKey(fullConfig);

  // Verificar cache
  const now = Date.now();
  if (
    !forceRefresh &&
    stockValuationCache.data &&
    stockValuationCache.timestamp &&
    stockValuationCache.configKey === configKey &&
    now - stockValuationCache.timestamp < CACHE_DURATION
  ) {
    console.log('Stock Valuation: Using cached data');
    return stockValuationCache.data;
  }

  console.log('Stock Valuation: Calculating fresh data...');
  const startTime = Date.now();

  try {
    // 1. Obtener artículos activos (con o sin stock según configuración)
    const whereClause: any = {
      deleted_at: null,
      is_active: true,
    };

    // Si no se incluyen artículos sin stock, filtrar stock > 0
    if (!fullConfig.includeZeroStock) {
      whereClause.stock = { gt: 0 };
    }

    const articles = await prisma.articles.findMany({
      where: whereClause,
      select: {
        id: true,
        code: true,
        description: true,
        stock: true,
        cost_price: true,
        unit_price: true,
      },
    });

    // 2. Obtener datos de ventas
    const [trendsData, lastSaleDates] = await Promise.all([
      calculateSalesTrends(fullConfig.trendMonths),
      calculateLastSaleDates(),
    ]);

    // 3. Calcular métricas para cada artículo
    const metrics: StockValuationMetrics[] = [];

    for (const article of articles) {
      const articleId = article.id.toString();
      const salesTrend = trendsData.data.get(articleId) || [];
      const lastSaleDate = lastSaleDates.get(articleId) || null;
      
      const currentStock = Number(article.stock);
      const costPrice = Number(article.cost_price || 0);
      const unitPrice = Number(article.unit_price || 0);

      // Calcular días desde última venta
      const daysSinceLastSale = lastSaleDate
        ? Math.floor((Date.now() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Calcular promedio de ventas mensuales
      const totalSalesInPeriod = salesTrend.reduce((a, b) => a + b, 0);
      const avgMonthlySales = salesTrend.length > 0 
        ? totalSalesInPeriod / salesTrend.length 
        : 0;

      // Calcular tendencia
      const trendDirection = calculateTrendDirection(salesTrend);

      // Calcular velocidad de rotación
      const rotationVelocity = avgMonthlySales;

      // Estimar días para agotar stock
      const estimatedDaysToSellOut = avgMonthlySales > 0 
        ? Math.ceil((currentStock / avgMonthlySales) * 30) 
        : null;

      // Meses de inventario
      const monthsOfInventory = avgMonthlySales > 0
        ? currentStock / avgMonthlySales
        : 999;

      // Clasificar status
      const status = classifyStockStatus(
        lastSaleDate,
        daysSinceLastSale,
        avgMonthlySales,
        trendDirection,
        currentStock,
        fullConfig
      );

      // Valores monetarios
      const stockValue = currentStock * costPrice;
      const stockValueAtSalePrice = currentStock * unitPrice;
      const potentialProfit = stockValueAtSalePrice - stockValue;

      metrics.push({
        articleId,
        articleCode: article.code,
        articleDescription: article.description,
        status,
        daysSinceLastSale,
        lastSaleDate,
        avgMonthlySales,
        salesTrend,
        salesTrendDirection: trendDirection,
        totalSalesInPeriod,
        currentStock,
        stockValue,
        stockValueAtSalePrice,
        potentialProfit,
        rotationVelocity,
        estimatedDaysToSellOut,
        monthsOfInventory,
      });
    }

    // 4. Agrupar por status
    const byStatus: StockValuationSummary['byStatus'] = {
      [StockStatus.ACTIVE]: {
        count: 0,
        totalValue: 0,
        totalValueAtSale: 0,
        totalPotentialProfit: 0,
        articles: [],
      },
      [StockStatus.SLOW_MOVING]: {
        count: 0,
        totalValue: 0,
        totalValueAtSale: 0,
        totalPotentialProfit: 0,
        articles: [],
      },
      [StockStatus.DEAD_STOCK]: {
        count: 0,
        totalValue: 0,
        totalValueAtSale: 0,
        totalPotentialProfit: 0,
        articles: [],
      },
      [StockStatus.NEVER_SOLD]: {
        count: 0,
        totalValue: 0,
        totalValueAtSale: 0,
        totalPotentialProfit: 0,
        articles: [],
      },
    };

    for (const metric of metrics) {
      const group = byStatus[metric.status];
      group.count++;
      group.totalValue += metric.stockValue;
      group.totalValueAtSale += metric.stockValueAtSalePrice;
      group.totalPotentialProfit += metric.potentialProfit;
      group.articles.push(metric);
    }

    // Ordenar artículos dentro de cada grupo por valor descendente
    Object.values(byStatus).forEach(group => {
      group.articles.sort((a, b) => b.stockValue - a.stockValue);
    });

    // 5. Calcular totales
    const totals = {
      totalArticles: metrics.length,
      totalStockValue: metrics.reduce((sum, m) => sum + m.stockValue, 0),
      totalValueAtSale: metrics.reduce((sum, m) => sum + m.stockValueAtSalePrice, 0),
      totalPotentialProfit: metrics.reduce((sum, m) => sum + m.potentialProfit, 0),
    };

    const summary: StockValuationSummary = {
      byStatus,
      totals,
      calculatedAt: new Date(),
      config: fullConfig,
    };

    // 6. Actualizar cache
    stockValuationCache.data = summary;
    stockValuationCache.timestamp = now;
    stockValuationCache.configKey = configKey;

    const duration = Date.now() - startTime;
    console.log(`Stock Valuation: Calculated for ${metrics.length} articles in ${duration}ms`);
    console.log(`  - Dead Stock: ${byStatus.dead_stock.count} ($${byStatus.dead_stock.totalValue.toFixed(2)})`);
    console.log(`  - Slow Moving: ${byStatus.slow_moving.count} ($${byStatus.slow_moving.totalValue.toFixed(2)})`);
    console.log(`  - Active: ${byStatus.active.count} ($${byStatus.active.totalValue.toFixed(2)})`);
    console.log(`  - Never Sold: ${byStatus.never_sold.count} ($${byStatus.never_sold.totalValue.toFixed(2)})`);

    return summary;
  } catch (error) {
    console.error('Error calculating stock valuation:', error);
    throw error;
  }
}

/**
 * Calcula la dirección de la tendencia de ventas
 */
function calculateTrendDirection(
  salesTrend: number[]
): 'increasing' | 'stable' | 'decreasing' | 'none' {
  if (salesTrend.length < 2) return 'none';

  const midPoint = Math.floor(salesTrend.length / 2);
  const firstHalf = salesTrend.slice(0, midPoint);
  const secondHalf = salesTrend.slice(midPoint);

  const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  // Evitar división por cero
  if (avgFirstHalf === 0 && avgSecondHalf === 0) return 'none';
  if (avgFirstHalf === 0) return 'increasing';

  const changePercent = ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100;

  if (changePercent > 20) return 'increasing';
  if (changePercent < -20) return 'decreasing';
  return 'stable';
}

/**
 * Clasifica el status del stock según los criterios configurados
 * IMPORTANTE: Esta función asume que currentStock > 0
 */
function classifyStockStatus(
  lastSaleDate: Date | null,
  daysSinceLastSale: number | null,
  avgMonthlySales: number,
  trendDirection: 'increasing' | 'stable' | 'decreasing' | 'none',
  currentStock: number,
  config: StockClassificationConfig
): StockStatus {
  
  // Validación: No debería llegar stock = 0 aquí (se filtra en la query)
  if (currentStock <= 0) {
    console.warn(`Article with stock ${currentStock} reached classification - should be filtered`);
    return StockStatus.NEVER_SOLD;
  }

  // Nunca se vendió (y tiene stock)
  if (!lastSaleDate || daysSinceLastSale === null) {
    return StockStatus.NEVER_SOLD;
  }

  // DEAD STOCK: No se vendió en el período máximo
  if (daysSinceLastSale > config.deadStockThresholdDays) {
    return StockStatus.DEAD_STOCK;
  }

  // ACTIVE: Ventas recientes y buenas
  if (
    daysSinceLastSale <= config.activeThresholdDays &&
    avgMonthlySales >= config.minSalesForActive
  ) {
    return StockStatus.ACTIVE;
  }

  // SLOW MOVING: Ventas bajas o tendencia decreciente
  if (
    daysSinceLastSale > config.slowMovingThresholdDays ||
    (avgMonthlySales < config.minSalesForActive && trendDirection === 'decreasing')
  ) {
    return StockStatus.SLOW_MOVING;
  }

  // Si tiene ventas pero no entra en active
  if (avgMonthlySales > 0) {
    return StockStatus.SLOW_MOVING;
  }

  // Por defecto
  return StockStatus.DEAD_STOCK;
}

/**
 * Fuerza el recálculo de la valorización
 */
export async function refreshStockValuation(
  config?: Partial<StockClassificationConfig>
): Promise<StockValuationSummary> {
  return calculateStockValuation(config, true);
}

/**
 * Obtiene información del caché
 */
export function getStockValuationCacheInfo(): StockValuationCacheInfo {
  if (!stockValuationCache.timestamp || !stockValuationCache.data) {
    return {
      isCached: false,
      age: null,
      ageHours: null,
      expiresIn: null,
      expiresInHours: null,
      calculatedAt: null,
      articlesCount: 0,
      config: null,
    };
  }

  const age = Date.now() - stockValuationCache.timestamp;
  const expiresIn = CACHE_DURATION - age;

  return {
    isCached: true,
    age,
    ageHours: (age / (1000 * 60 * 60)).toFixed(2),
    expiresIn: expiresIn > 0 ? expiresIn : 0,
    expiresInHours: expiresIn > 0 ? (expiresIn / (1000 * 60 * 60)).toFixed(2) : '0',
    calculatedAt: stockValuationCache.data.calculatedAt,
    articlesCount: stockValuationCache.data.totals.totalArticles,
    config: stockValuationCache.data.config,
  };
}

