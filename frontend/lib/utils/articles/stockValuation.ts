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
import { getArticleCifCost } from './marginCalculations';
import { calculateSalesTrends, calculateLastSaleDates, countMonthsWithSales } from './salesTrends';

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
 * Genera una clave única para la configuración (sólo campos que afectan la
 * clasificación o el dataset valorizado).
 */
function getConfigKey(config: StockClassificationConfig): string {
  return [
    config.activeThresholdDays,
    config.trendMonths,
    config.includeZeroStock,
    config.minMonthsForActive,
    config.minMonthsForLeavingDead,
    config.deadStockNoActivityWindowMonths,
    config.upgradeConfirmDays,
    config.downgradeConfirmDays,
    config.fastUpgradeMonthsThreshold,
  ].join('-');
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
    minMonthsForActive: config.minMonthsForActive ?? 2,
    minMonthsForLeavingDead: config.minMonthsForLeavingDead ?? 2,
    deadStockNoActivityWindowMonths: config.deadStockNoActivityWindowMonths ?? 12,
    upgradeConfirmDays: config.upgradeConfirmDays ?? 7,
    downgradeConfirmDays: config.downgradeConfirmDays ?? 14,
    fastUpgradeMonthsThreshold: config.fastUpgradeMonthsThreshold ?? 4,
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
        last_purchase_proforma_number: true,
        last_purchase_proforma_date: true,
        cif_percentage: true,
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

    // 2. Obtener datos de ventas + historia para histéresis
    // - `trendsData` (display): respeta `trendMonths` para el sparkline.
    // - `classificationTrends`: ventana fija que cubra
    //   `deadStockNoActivityWindowMonths` (12 por default), necesaria para los
    //   conteos de meses con ventas que usa la regla nueva.
    const classificationMonths = Math.max(
      fullConfig.deadStockNoActivityWindowMonths ?? 12,
      fullConfig.trendMonths
    );
    const [trendsData, classificationTrends, lastSaleDates, recentStatuses] = await Promise.all([
      calculateSalesTrends(fullConfig.trendMonths),
      classificationMonths === fullConfig.trendMonths
        ? Promise.resolve(null)
        : calculateSalesTrends(classificationMonths),
      calculateLastSaleDates(),
      // El cron persiste un snapshot por artículo por día. Pedimos lo
      // suficiente para cubrir la mayor de las ventanas de confirmación más un
      // pequeño margen para tolerar huecos del cron.
      getRecentArticleStatuses(
        Math.max(fullConfig.upgradeConfirmDays ?? 7, fullConfig.downgradeConfirmDays ?? 14) + 3
      ),
    ]);

    // 3. Calcular métricas para cada artículo
    const metrics: StockValuationMetrics[] = [];

    for (const article of articles) {
      const articleId = article.id.toString();
      const salesTrend = trendsData.data.get(articleId) || [];
      const lastSaleDate = lastSaleDates.get(articleId) || null;

      const currentStock = Number(article.stock);
      // Costo CIF unificado con la lista de artículos: FOB × (1 + CIF%).
      // Fallback a cost_price si no hay last_purchase_price.
      const lastPurchase =
        article.last_purchase_price !== null && article.last_purchase_price !== undefined
          ? Number(article.last_purchase_price)
          : null;
      const cifPct =
        article.cif_percentage !== null && article.cif_percentage !== undefined
          ? Number(article.cif_percentage)
          : null;
      const cifCost = getArticleCifCost({ lastPurchasePrice: lastPurchase, cifPercentage: cifPct });
      const fallbackCost =
        article.cost_price !== null && article.cost_price !== undefined
          ? Number(article.cost_price)
          : 0;
      const costPrice = cifCost ?? fallbackCost;
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

      // Clasificar status (capa 1 + histéresis sobre snapshots recientes)
      const classificationTrend = (classificationTrends ?? trendsData).data.get(articleId) || [];
      const articleHistory = recentStatuses.get(articleId) ?? [];
      const previousStatus =
        articleHistory.length > 0 ? articleHistory[articleHistory.length - 1].status : null;
      const status = classifyStockStatus(
        {
          lastSaleDate,
          daysSinceLastSale,
          salesTrend: classificationTrend,
          currentStock,
        },
        previousStatus,
        articleHistory,
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
        unitCostFob: lastPurchase ?? 0,
        lastPurchaseProformaNumber: article.last_purchase_proforma_number ?? null,
        lastPurchaseProformaDate: article.last_purchase_proforma_date
          ? article.last_purchase_proforma_date.toISOString().slice(0, 10)
          : null,
        cifPercentage: cifPct ?? 0,
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
 * Señales puntuales que necesita la regla de clasificación de un artículo.
 * El orden cronológico de `salesTrend` es ascendente: el último elemento es el
 * mes más reciente.
 */
export interface ClassificationSignals {
  lastSaleDate: Date | null;
  daysSinceLastSale: number | null;
  salesTrend: number[];
  currentStock: number;
}

/**
 * Snapshots diarios recientes del estado de un artículo, ordenados
 * cronológicamente (oldest first).
 */
export type RecentSnapshotStatuses = { date: Date; status: StockStatus }[];

/** Defaults aplicados cuando un campo opcional no viene en el config. */
const CLASSIFIER_DEFAULTS = {
  activeThresholdDays: 90,
  minMonthsForActive: 2,
  minMonthsForLeavingDead: 2,
  deadStockNoActivityWindowMonths: 12,
  upgradeConfirmDays: 7,
  downgradeConfirmDays: 14,
  fastUpgradeMonthsThreshold: 4,
} as const;

/**
 * Clasifica un artículo en uno de los 4 `StockStatus` aplicando dos capas:
 *
 * 1. {@link computeCandidate} — regla pura sobre las señales del momento, basada
 *    en frecuencia mensual de ventas (no velocidad).
 * 2. Histéresis — confirma transiciones contra `recentSnapshotStatuses` para
 *    evitar que una venta única (incluso histórica) saque a un artículo de su
 *    estado anterior.
 *
 * La regla nueva ignora los campos deprecados del config
 * (`slowMovingThresholdDays`, `deadStockThresholdDays`, `minSalesForActive`).
 */
export function classifyStockStatus(
  signals: ClassificationSignals,
  previousStatus: StockStatus | null,
  recentSnapshotStatuses: RecentSnapshotStatuses,
  config: StockClassificationConfig
): StockStatus {
  const candidate = computeCandidate(signals, config);

  // Primera ejecución (sin historia): aceptar el candidato directo. La capa 1
  // ya hizo el trabajo grueso; la histéresis sólo ayuda en casos límite.
  if (previousStatus === null) return candidate;
  if (candidate === previousStatus) return candidate;

  const fastThreshold =
    config.fastUpgradeMonthsThreshold ?? CLASSIFIER_DEFAULTS.fastUpgradeMonthsThreshold;
  const upConfirm = config.upgradeConfirmDays ?? CLASSIFIER_DEFAULTS.upgradeConfirmDays;
  const downConfirm = config.downgradeConfirmDays ?? CLASSIFIER_DEFAULTS.downgradeConfirmDays;

  // Escape hatch: reactivación claramente sostenida → upgrade inmediato.
  if (
    isUpgrade(previousStatus, candidate) &&
    countMonthsWithSales(signals.salesTrend, 6) >= fastThreshold
  ) {
    return candidate;
  }

  if (isUpgrade(previousStatus, candidate)) {
    return confirmedFor(candidate, recentSnapshotStatuses, upConfirm) ? candidate : previousStatus;
  }

  if (isDowngrade(previousStatus, candidate)) {
    return confirmedFor(candidate, recentSnapshotStatuses, downConfirm)
      ? candidate
      : previousStatus;
  }

  return candidate;
}

/**
 * Capa 1 — regla pura. Devuelve el estado que correspondería al artículo
 * mirando sólo sus señales del momento (sin historia de snapshots).
 */
export function computeCandidate(
  signals: ClassificationSignals,
  config: StockClassificationConfig
): StockStatus {
  const { lastSaleDate, daysSinceLastSale, salesTrend, currentStock } = signals;

  if (currentStock <= 0) return StockStatus.NEVER_SOLD;
  if (!lastSaleDate || daysSinceLastSale === null) return StockStatus.NEVER_SOLD;

  const deadWindow =
    config.deadStockNoActivityWindowMonths ?? CLASSIFIER_DEFAULTS.deadStockNoActivityWindowMonths;
  const minMonthsLeaveDead =
    config.minMonthsForLeavingDead ?? CLASSIFIER_DEFAULTS.minMonthsForLeavingDead;
  const minMonthsActive = config.minMonthsForActive ?? CLASSIFIER_DEFAULTS.minMonthsForActive;
  const recencyDays = config.activeThresholdDays ?? CLASSIFIER_DEFAULTS.activeThresholdDays;

  const monthsInDeadWindow = countMonthsWithSales(salesTrend, deadWindow);
  if (monthsInDeadWindow < minMonthsLeaveDead) {
    return StockStatus.DEAD_STOCK;
  }

  const monthsLast3 = countMonthsWithSales(salesTrend, 3);
  if (daysSinceLastSale <= recencyDays && monthsLast3 >= minMonthsActive) {
    return StockStatus.ACTIVE;
  }

  return StockStatus.SLOW_MOVING;
}

const STATUS_SEVERITY: Record<StockStatus, number> = {
  [StockStatus.NEVER_SOLD]: 0,
  [StockStatus.DEAD_STOCK]: 1,
  [StockStatus.SLOW_MOVING]: 2,
  [StockStatus.ACTIVE]: 3,
};

export function isUpgrade(prev: StockStatus, next: StockStatus): boolean {
  return STATUS_SEVERITY[next] > STATUS_SEVERITY[prev];
}

export function isDowngrade(prev: StockStatus, next: StockStatus): boolean {
  return STATUS_SEVERITY[next] < STATUS_SEVERITY[prev];
}

/**
 * Confirma si los `requiredDays` snapshots más recientes coinciden con
 * `target`. Cuenta días con snapshot, no días calendario, así que tolera
 * huecos del cron. Si la historia disponible es menor que `requiredDays`,
 * devuelve false (no hay evidencia suficiente).
 */
export function confirmedFor(
  target: StockStatus,
  recentSnapshotStatuses: RecentSnapshotStatuses,
  requiredDays: number
): boolean {
  if (requiredDays <= 0) return true;
  if (recentSnapshotStatuses.length < requiredDays) return false;
  const tail = recentSnapshotStatuses.slice(-requiredDays);
  return tail.every((s) => s.status === target);
}

/**
 * Lee los snapshots diarios del estado por artículo en los últimos `daysBack`
 * días desde `article_status_snapshots`. Devuelve un Map articleId → snapshots
 * ordenados cronológicamente (oldest first).
 *
 * Vive acá (en lugar de StockSnapshotService) para evitar dependencia
 * circular: StockSnapshotService ya importa de este archivo. El servicio lo
 * re-exporta para callers externos.
 */
export async function getRecentArticleStatuses(
  daysBack: number
): Promise<Map<string, RecentSnapshotStatuses>> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - daysBack);
  since.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.article_status_snapshots.findMany({
    where: { date: { gte: since } },
    orderBy: { date: 'asc' },
    select: { article_id: true, date: true, status: true },
  });

  const result = new Map<string, RecentSnapshotStatuses>();
  for (const row of rows) {
    const key = row.article_id.toString();
    let list = result.get(key);
    if (!list) {
      list = [];
      result.set(key, list);
    }
    list.push({ date: row.date, status: row.status as StockStatus });
  }
  return result;
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
