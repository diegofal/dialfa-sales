import { Calendar, TrendingDown, TrendingUp, Minus, PackageX, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkline } from '@/components/ui/sparkline';
import { ROUTES } from '@/lib/constants/routes';
import { StockStatus, StockValuationMetrics } from '@/types/stockValuation';

interface ValuationCardProps {
  metric: StockValuationMetrics;
}

const statusConfig = {
  [StockStatus.ACTIVE]: {
    label: 'Activo',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    icon: TrendingUp,
  },
  [StockStatus.SLOW_MOVING]: {
    label: 'Movimiento Lento',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    icon: TrendingDown,
  },
  [StockStatus.DEAD_STOCK]: {
    label: 'Stock Muerto',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    icon: PackageX,
  },
  [StockStatus.NEVER_SOLD]: {
    label: 'Nunca Vendido',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    icon: Minus,
  },
};

const trendConfig = {
  increasing: { icon: TrendingUp, color: 'text-green-600 dark:text-green-400', label: 'Creciente' },
  stable: { icon: Minus, color: 'text-blue-600 dark:text-blue-400', label: 'Estable' },
  decreasing: { icon: TrendingDown, color: 'text-red-600 dark:text-red-400', label: 'Decreciente' },
  none: { icon: Minus, color: 'text-gray-600 dark:text-gray-400', label: 'Sin datos' },
};

export function ValuationCard({ metric }: ValuationCardProps) {
  const router = useRouter();
  const config = statusConfig[metric.status];
  const trend = trendConfig[metric.salesTrendDirection];
  const StatusIcon = config.icon;
  const TrendIcon = trend.icon;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getSparklineColor = () => {
    switch (metric.salesTrendDirection) {
      case 'increasing':
        return 'rgb(34, 197, 94)'; // green
      case 'decreasing':
        return 'rgb(239, 68, 68)'; // red
      default:
        return 'rgb(59, 130, 246)'; // blue
    }
  };

  const handleViewDetails = () => {
    router.push(`${ROUTES.ARTICLES}?search=${metric.articleCode}`);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base font-semibold">{metric.articleCode}</CardTitle>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
              {metric.articleDescription}
            </p>
          </div>
          <Badge className={`${config.color} shrink-0`}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Stock Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-muted-foreground text-xs">Stock Actual</p>
            <p className="text-lg font-bold">{metric.currentStock.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3" />
              Última Venta
            </p>
            <p className="text-sm font-semibold">
              {metric.daysSinceLastSale !== null
                ? `Hace ${metric.daysSinceLastSale} días`
                : 'Nunca'}
            </p>
            <p className="text-muted-foreground text-xs">{formatDate(metric.lastSaleDate)}</p>
          </div>
        </div>

        {/* Sales Trend */}
        {metric.salesTrend.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                <TrendIcon className={`h-3 w-3 ${trend.color}`} />
                Tendencia: {trend.label}
              </p>
              <p className="text-muted-foreground text-xs">
                Promedio: {metric.avgMonthlySales.toFixed(1)}/mes
              </p>
            </div>
            <Sparkline
              data={metric.salesTrend}
              width={280}
              height={40}
              color={getSparklineColor()}
              fillColor={`${getSparklineColor()}20`}
            />
          </div>
        )}

        {/* Valuation */}
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Valor Costo:</span>
            <span className="text-sm font-semibold">{formatCurrency(metric.stockValue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Valor Lista:</span>
            <span className="text-sm font-semibold">
              {formatCurrency(metric.stockValueAtListPrice)}
            </span>
          </div>
        </div>

        {/* Inventory Metrics */}
        {metric.estimatedDaysToSellOut !== null && (
          <div className="text-muted-foreground text-xs">
            <p>
              Tiempo estimado para agotar:{' '}
              <span className="text-foreground font-semibold">
                {metric.estimatedDaysToSellOut} días ({metric.monthsOfInventory.toFixed(1)} meses)
              </span>
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t pt-4">
        <Button variant="outline" size="sm" className="w-full" onClick={handleViewDetails}>
          <ExternalLink className="mr-2 h-3 w-3" />
          Ver Detalles
        </Button>
      </CardFooter>
    </Card>
  );
}
