import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StockStatus, StockValuationMetrics } from '@/types/stockValuation';
import { Sparkline } from '@/components/ui/sparkline';
import { Calendar, TrendingDown, TrendingUp, Minus, PackageX, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
    router.push(`/dashboard/articles?search=${metric.articleCode}`);
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate">
              {metric.articleCode}
            </CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {metric.articleDescription}
            </p>
          </div>
          <Badge className={`${config.color} shrink-0`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1">
        {/* Stock Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Stock Actual</p>
            <p className="text-lg font-bold">{metric.currentStock.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Última Venta
            </p>
            <p className="text-sm font-semibold">
              {metric.daysSinceLastSale !== null 
                ? `Hace ${metric.daysSinceLastSale} días`
                : 'Nunca'}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(metric.lastSaleDate)}</p>
          </div>
        </div>

        {/* Sales Trend */}
        {metric.salesTrend.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendIcon className={`h-3 w-3 ${trend.color}`} />
                Tendencia: {trend.label}
              </p>
              <p className="text-xs text-muted-foreground">
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
        <div className="pt-3 border-t space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Valor Costo:</span>
            <span className="text-sm font-semibold">{formatCurrency(metric.stockValue)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Valor Lista:</span>
            <span className="text-sm font-semibold">{formatCurrency(metric.stockValueAtListPrice)}</span>
          </div>
        </div>

        {/* Inventory Metrics */}
        {metric.estimatedDaysToSellOut !== null && (
          <div className="text-xs text-muted-foreground">
            <p>Tiempo estimado para agotar: <span className="font-semibold text-foreground">
              {metric.estimatedDaysToSellOut} días ({metric.monthsOfInventory.toFixed(1)} meses)
            </span></p>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleViewDetails}
        >
          <ExternalLink className="h-3 w-3 mr-2" />
          Ver Detalles
        </Button>
      </CardFooter>
    </Card>
  );
}

