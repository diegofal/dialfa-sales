import { prisma } from '@/lib/db';
import { calculateTrendDirection } from '@/lib/utils/salesCalculations';
import {
  StockStatus,
  StockClassificationConfig,
  StockValuationMetrics,
  StockValuationSummary,
  StockValuationCacheInfo,
  CategoryValuationData,
  PaymentTermValuation,
} from '@/types/stockValuation';
import { calculateSalesTrends, calculateLastSaleDates } from './salesTrends';

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
    return stockValuationCache.data;
  }

  try {
    // 1. Obtener payment terms activas
    const paymentTerms = await prisma.payment_terms.findMany({
      where: { is_active: true },
      orderBy: { days: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    // 2. Obtener todos los descuentos por categoría y payment term
    const categoryPaymentDiscounts = await prisma.category_payment_discounts.findMany({
      select: {
        category_id: true,
        payment_term_id: true,
        discount_percent: true,
      },
    });

    // Crear un mapa para acceso rápido: `categoryId-paymentTermId` -> discountPercent
    const discountMap = new Map<string, number>();
    for (const cpd of categoryPaymentDiscounts) {
      const key = `${cpd.category_id}-${cpd.payment_term_id}`;
      discountMap.set(key, Number(cpd.discount_percent));
    }

    // 3. Obtener TODOS los artículos (activos e inactivos, con o sin stock según configuración)
    // La valorización debe incluir todos los items que tengan valor en el inventario
    const whereClause: {
      deleted_at: null;
      stock?: { gt: number };
    } = {
      deleted_at: null,
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
        last_purchase_price: true,
        category_id: true,
        categories: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
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
      // Usar last_purchase_price como costo, con cost_price como fallback
      // Usar ?? (nullish coalescing) en lugar de || para permitir valor 0
      const costPrice =
        article.last_purchase_price !== null && article.last_purchase_price !== undefined
          ? Number(article.last_purchase_price)
          : article.cost_price !== null && article.cost_price !== undefined
            ? Number(article.cost_price)
            : 0;
      const unitPrice = Number(article.unit_price || 0);

      // Calcular días desde última venta
      const daysSinceLastSale = lastSaleDate
        ? Math.floor((Date.now() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Calcular promedio de ventas mensuales
      const totalSalesInPeriod = salesTrend.reduce((a, b) => a + b, 0);
      const avgMonthlySales = salesTrend.length > 0 ? totalSalesInPeriod / salesTrend.length : 0;

      // Calcular tendencia
      const trendDirection = calculateTrendDirection(salesTrend);

      // Calcular velocidad de rotación
      const rotationVelocity = avgMonthlySales;

      // Estimar días para agotar stock
      const estimatedDaysToSellOut =
        avgMonthlySales > 0 ? Math.ceil((currentStock / avgMonthlySales) * 30) : null;

      // Meses de inventario
      const monthsOfInventory = avgMonthlySales > 0 ? currentStock / avgMonthlySales : 999;

      // Clasificar status
      const status = classifyStockStatus(
        lastSaleDate,
        daysSinceLastSale,
        avgMonthlySales,
        trendDirection,
        currentStock,
        fullConfig
      );

      // Obtener descuento de la categoría
      const categoryId = Number(article.category_id);

      // Valores monetarios base (necesarios para calcular paymentTermsValuation)
      const stockValue = currentStock * costPrice;
      const stockValueAtListPrice = currentStock * unitPrice;
      const potentialProfitAtListPrice = stockValueAtListPrice - stockValue;

      // Calcular valorización por cada payment term
      const paymentTermsValuation: PaymentTermValuation[] = paymentTerms.map((pt) => {
        const discountKey = `${categoryId}-${pt.id}`;
        const discountPercent = discountMap.get(discountKey) || 0;
        const unitPriceWithDiscount = unitPrice * (1 - discountPercent / 100);
        const stockValueAtDiscountedPrice = currentStock * unitPriceWithDiscount;
        const potentialProfit = stockValueAtDiscountedPrice - stockValue;

        return {
          paymentTermId: pt.id,
          paymentTermCode: pt.code,
          paymentTermName: pt.name,
          discountPercent,
          unitPriceWithDiscount,
          stockValueAtDiscountedPrice,
          potentialProfit,
        };
      });

      metrics.push({
        articleId,
        articleCode: article.code,
        articleDescription: article.description,
        status,
        categoryId: Number(article.category_id),
        categoryCode: article.categories?.code || '',
        categoryName: article.categories?.name || 'Sin categoría',
        daysSinceLastSale,
        lastSaleDate,
        avgMonthlySales,
        salesTrend,
        salesTrendDirection: trendDirection,
        totalSalesInPeriod,
        currentStock,
        unitCost: costPrice,
        unitPrice,
        stockValue,
        stockValueAtListPrice,
        potentialProfitAtListPrice,
        paymentTermsValuation,
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
        totalValueAtListPrice: 0,
        paymentTermsValuation: paymentTerms.map((pt) => ({
          paymentTermId: pt.id,
          paymentTermCode: pt.code,
          paymentTermName: pt.name,
          discountPercent: 0,
          unitPriceWithDiscount: 0,
          stockValueAtDiscountedPrice: 0,
          potentialProfit: 0,
        })),
        articles: [],
      },
      [StockStatus.SLOW_MOVING]: {
        count: 0,
        totalValue: 0,
        totalValueAtListPrice: 0,
        paymentTermsValuation: paymentTerms.map((pt) => ({
          paymentTermId: pt.id,
          paymentTermCode: pt.code,
          paymentTermName: pt.name,
          discountPercent: 0,
          unitPriceWithDiscount: 0,
          stockValueAtDiscountedPrice: 0,
          potentialProfit: 0,
        })),
        articles: [],
      },
      [StockStatus.DEAD_STOCK]: {
        count: 0,
        totalValue: 0,
        totalValueAtListPrice: 0,
        paymentTermsValuation: paymentTerms.map((pt) => ({
          paymentTermId: pt.id,
          paymentTermCode: pt.code,
          paymentTermName: pt.name,
          discountPercent: 0,
          unitPriceWithDiscount: 0,
          stockValueAtDiscountedPrice: 0,
          potentialProfit: 0,
        })),
        articles: [],
      },
      [StockStatus.NEVER_SOLD]: {
        count: 0,
        totalValue: 0,
        totalValueAtListPrice: 0,
        paymentTermsValuation: paymentTerms.map((pt) => ({
          paymentTermId: pt.id,
          paymentTermCode: pt.code,
          paymentTermName: pt.name,
          discountPercent: 0,
          unitPriceWithDiscount: 0,
          stockValueAtDiscountedPrice: 0,
          potentialProfit: 0,
        })),
        articles: [],
      },
    };

    for (const metric of metrics) {
      const group = byStatus[metric.status];
      group.count++;
      group.totalValue += metric.stockValue;
      group.totalValueAtListPrice += metric.stockValueAtListPrice;

      // Agregar valores por payment term
      metric.paymentTermsValuation.forEach((ptv, index) => {
        group.paymentTermsValuation[index].stockValueAtDiscountedPrice +=
          ptv.stockValueAtDiscountedPrice;
        group.paymentTermsValuation[index].potentialProfit += ptv.potentialProfit;
      });

      group.articles.push(metric);
    }

    // Ordenar artículos dentro de cada grupo por valor descendente
    Object.values(byStatus).forEach((group) => {
      group.articles.sort((a, b) => b.stockValue - a.stockValue);
    });

    // 5. Agrupar por categoría
    const categoryMap = new Map<number, CategoryValuationData>();

    for (const metric of metrics) {
      const categoryId = metric.categoryId;

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          categoryId,
          categoryCode: metric.categoryCode,
          categoryName: metric.categoryName,
          count: 0,
          totalValue: 0,
          totalValueAtListPrice: 0,
          paymentTermsValuation: paymentTerms.map((pt) => {
            const discountKey = `${categoryId}-${pt.id}`;
            const discountPercent = discountMap.get(discountKey) || 0;
            return {
              paymentTermId: pt.id,
              paymentTermCode: pt.code,
              paymentTermName: pt.name,
              discountPercent,
              unitPriceWithDiscount: 0,
              stockValueAtDiscountedPrice: 0,
              potentialProfit: 0,
            };
          }),
          byStatus: {
            [StockStatus.ACTIVE]: 0,
            [StockStatus.SLOW_MOVING]: 0,
            [StockStatus.DEAD_STOCK]: 0,
            [StockStatus.NEVER_SOLD]: 0,
          },
        });
      }

      const category = categoryMap.get(categoryId)!;
      category.count++;
      category.totalValue += metric.stockValue;
      category.totalValueAtListPrice += metric.stockValueAtListPrice;

      // Agregar valores por payment term
      metric.paymentTermsValuation.forEach((ptv, index) => {
        category.paymentTermsValuation[index].stockValueAtDiscountedPrice +=
          ptv.stockValueAtDiscountedPrice;
        category.paymentTermsValuation[index].potentialProfit += ptv.potentialProfit;
      });

      category.byStatus[metric.status]++;
    }

    // Ordenar categorías por valor total descendente
    const byCategory = Array.from(categoryMap.values()).sort((a, b) => b.totalValue - a.totalValue);

    // 6. Calcular totales
    const totals = {
      totalArticles: metrics.length,
      totalStockValue: metrics.reduce((sum, m) => sum + m.stockValue, 0),
      totalValueAtListPrice: metrics.reduce((sum, m) => sum + m.stockValueAtListPrice, 0),
      paymentTermsValuation: paymentTerms.map((pt) => ({
        paymentTermId: pt.id,
        paymentTermCode: pt.code,
        paymentTermName: pt.name,
        discountPercent: 0,
        unitPriceWithDiscount: 0,
        stockValueAtDiscountedPrice: 0,
        potentialProfit: 0,
      })),
    };

    // Agregar valores por payment term a los totales
    metrics.forEach((metric) => {
      metric.paymentTermsValuation.forEach((ptv, index) => {
        totals.paymentTermsValuation[index].stockValueAtDiscountedPrice +=
          ptv.stockValueAtDiscountedPrice;
        totals.paymentTermsValuation[index].potentialProfit += ptv.potentialProfit;
      });
    });

    const summary: StockValuationSummary = {
      byStatus,
      byCategory,
      totals,
      calculatedAt: new Date(),
      config: fullConfig,
    };

    // 6. Actualizar cache
    stockValuationCache.data = summary;
    stockValuationCache.timestamp = now;
    stockValuationCache.configKey = configKey;

    return summary;
  } catch (error) {
    throw error;
  }
}

/**
 * Clasifica el status del stock según los criterios configurados
 * IMPORTANTE: Esta función asume que currentStock > 0
 */
export function classifyStockStatus(
  lastSaleDate: Date | null,
  daysSinceLastSale: number | null,
  avgMonthlySales: number,
  trendDirection: 'increasing' | 'stable' | 'decreasing' | 'none',
  currentStock: number,
  config: StockClassificationConfig
): StockStatus {
  if (currentStock <= 0) {
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
