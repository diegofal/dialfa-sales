import { TrendingDown, Activity, PackageX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SparklineWithTooltip } from '@/components/ui/sparkline';
import { StockCategorySnapshotsByStatus } from '@/types/stockSnapshot';
import { StockStatus, StockValuationSummary } from '@/types/stockValuation';

interface ValuationSummaryProps {
  valuation: StockValuationSummary;
  categorySnapshots?: StockCategorySnapshotsByStatus;
  onStatusClick?: (status: StockStatus) => void;
}

const statusConfig = {
  [StockStatus.ACTIVE]: {
    label: 'Activo',
    icon: Activity,
    color: 'bg-green-500',
    textColor: 'text-green-700 dark:text-green-400',
    badgeVariant: 'default' as const,
  },
  [StockStatus.SLOW_MOVING]: {
    label: 'Movimiento Lento',
    icon: TrendingDown,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    badgeVariant: 'secondary' as const,
  },
  [StockStatus.DEAD_STOCK]: {
    label: 'Stock Muerto',
    icon: PackageX,
    color: 'bg-red-500',
    textColor: 'text-red-700 dark:text-red-400',
    badgeVariant: 'destructive' as const,
  },
  [StockStatus.NEVER_SOLD]: {
    label: 'Nunca Vendido',
    icon: PackageX,
    color: 'bg-gray-500',
    textColor: 'text-gray-700 dark:text-gray-400',
    badgeVariant: 'outline' as const,
  },
};

const sparklineColors: Record<string, { stroke: string; fill: string }> = {
  [StockStatus.ACTIVE]: {
    stroke: 'rgb(34, 197, 94)',
    fill: 'rgba(34, 197, 94, 0.15)',
  },
  [StockStatus.SLOW_MOVING]: {
    stroke: 'rgb(234, 179, 8)',
    fill: 'rgba(234, 179, 8, 0.15)',
  },
  [StockStatus.DEAD_STOCK]: {
    stroke: 'rgb(239, 68, 68)',
    fill: 'rgba(239, 68, 68, 0.15)',
  },
  [StockStatus.NEVER_SOLD]: {
    stroke: 'rgb(156, 163, 175)',
    fill: 'rgba(156, 163, 175, 0.15)',
  },
};

export function ValuationSummary({
  valuation,
  categorySnapshots,
  onStatusClick,
}: ValuationSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const calculatePercentage = (value: number) => {
    if (valuation.totals.totalStockValue === 0) return 0;
    return ((value / valuation.totals.totalStockValue) * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Totales Generales */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm">Total Artículos</p>
              <p className="text-2xl font-bold">{valuation.totals.totalArticles}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Precio de Lista</p>
              <p className="text-2xl font-bold">
                {formatCurrency(valuation.totals.totalValueAtListPrice)}
              </p>
            </div>
          </div>

          {/* Totales por Condición de Pago */}
          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">Valorización por Condición de Pago</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {valuation.totals.paymentTermsValuation.map((ptv) => (
                <div
                  key={ptv.paymentTermId}
                  className="bg-card min-w-[180px] flex-shrink-0 rounded-lg border px-4 py-3"
                >
                  <div
                    className="text-primary mb-2 text-sm font-medium"
                    title={ptv.paymentTermName}
                  >
                    {ptv.paymentTermName}
                  </div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(ptv.stockValueAtDiscountedPrice)}
                  </div>
                  <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                    Ganancia: {formatCurrency(ptv.potentialProfit)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards por Categoría */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(statusConfig).map(([status, config]) => {
          const data = valuation.byStatus[status as StockStatus];
          const Icon = config.icon;
          const percentage = calculatePercentage(data.totalValue);

          return (
            <Card
              key={status}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                onStatusClick ? 'hover:scale-105' : ''
              }`}
              onClick={() => onStatusClick?.(status as StockStatus)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`rounded-md p-2 ${config.color} bg-opacity-10`}>
                      <Icon className={`h-4 w-4 ${config.textColor}`} />
                    </div>
                  </div>
                  <Badge variant={config.badgeVariant}>{data.count}</Badge>
                </div>
                <CardTitle className="mt-2 text-base">{config.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categorySnapshots?.[status] && categorySnapshots[status].counts.length > 1 && (
                  <div className="pb-1">
                    <SparklineWithTooltip
                      data={categorySnapshots[status].counts}
                      labels={categorySnapshots[status].dates}
                      formatValue={(v) => `${v} artículos`}
                      movements={categorySnapshots[status].movements}
                      width={200}
                      height={36}
                      color={sparklineColors[status]?.stroke}
                      fillColor={sparklineColors[status]?.fill}
                      autoScale
                    />
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">Valor Total</p>
                  <p className="text-lg font-bold">{formatCurrency(data.totalValue)}</p>
                  <p className="text-muted-foreground text-xs">{percentage}% del total</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-xs">Precio Lista</p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(data.totalValueAtListPrice)}
                  </p>
                </div>

                {/* Horizontal scrollable payment terms */}
                <div className="border-t pt-2">
                  <p className="text-muted-foreground mb-2 text-xs">Por Condición de Pago:</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {data.paymentTermsValuation.map((ptv) => (
                      <div
                        key={ptv.paymentTermId}
                        className="bg-background/50 min-w-[120px] flex-shrink-0 rounded border px-2 py-1.5"
                      >
                        <div
                          className="text-primary truncate text-xs font-medium"
                          title={ptv.paymentTermName}
                        >
                          {ptv.paymentTermName}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {formatCurrency(ptv.stockValueAtDiscountedPrice)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
