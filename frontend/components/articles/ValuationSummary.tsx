import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StockStatus, StockValuationSummary } from '@/types/stockValuation';
import { TrendingDown, TrendingUp, Activity, PackageX } from 'lucide-react';

interface ValuationSummaryProps {
  valuation: StockValuationSummary;
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

export function ValuationSummary({ valuation, onStatusClick }: ValuationSummaryProps) {
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Artículos</p>
              <p className="text-2xl font-bold">{valuation.totals.totalArticles}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Stock (Costo)</p>
              <p className="text-2xl font-bold">{formatCurrency(valuation.totals.totalStockValue)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Precio de Lista</p>
              <p className="text-2xl font-bold">{formatCurrency(valuation.totals.totalValueAtListPrice)}</p>
            </div>
          </div>

          {/* Totales por Condición de Pago */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-3">Valorización por Condición de Pago</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {valuation.totals.paymentTermsValuation.map((ptv) => (
                <div 
                  key={ptv.paymentTermId} 
                  className="flex-shrink-0 border rounded-lg px-4 py-3 bg-card min-w-[180px]"
                >
                  <div className="text-sm font-medium text-primary mb-2" title={ptv.paymentTermName}>
                    {ptv.paymentTermName}
                  </div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(ptv.stockValueAtDiscountedPrice)}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Ganancia: {formatCurrency(ptv.potentialProfit)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards por Categoría */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <div className={`p-2 rounded-md ${config.color} bg-opacity-10`}>
                      <Icon className={`h-4 w-4 ${config.textColor}`} />
                    </div>
                  </div>
                  <Badge variant={config.badgeVariant}>{data.count}</Badge>
                </div>
                <CardTitle className="text-base mt-2">{config.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-lg font-bold">{formatCurrency(data.totalValue)}</p>
                  <p className="text-xs text-muted-foreground">{percentage}% del total</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Precio Lista</p>
                  <p className="text-sm font-semibold">{formatCurrency(data.totalValueAtListPrice)}</p>
                </div>
                
                {/* Horizontal scrollable payment terms */}
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Por Condición de Pago:</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {data.paymentTermsValuation.map((ptv) => (
                      <div 
                        key={ptv.paymentTermId} 
                        className="flex-shrink-0 border rounded px-2 py-1.5 bg-background/50 min-w-[120px]"
                      >
                        <div className="text-xs font-medium text-primary truncate" title={ptv.paymentTermName}>
                          {ptv.paymentTermName}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Desc: {ptv.discountPercent.toFixed(0)}%
                        </div>
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
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

