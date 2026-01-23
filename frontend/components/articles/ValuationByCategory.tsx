import { Activity, TrendingDown, PackageX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryValuationData, StockStatus } from '@/types/stockValuation';

interface ValuationByCategoryProps {
  categories: CategoryValuationData[];
  totalStockValue: number;
  onCategoryClick?: (categoryId: number) => void;
  onStatusClick?: (categoryId: number, status: StockStatus) => void;
  onCategoryTotalClick?: (categoryId: number) => void;
  selectedCategoryId?: number | null;
  selectedStatus?: StockStatus | null;
}

const statusConfig = {
  [StockStatus.ACTIVE]: {
    label: 'Activo',
    color: 'bg-green-500',
    icon: Activity,
  },
  [StockStatus.SLOW_MOVING]: {
    label: 'Lento',
    color: 'bg-yellow-500',
    icon: TrendingDown,
  },
  [StockStatus.DEAD_STOCK]: {
    label: 'Muerto',
    color: 'bg-red-500',
    icon: PackageX,
  },
  [StockStatus.NEVER_SOLD]: {
    label: 'Sin Venta',
    color: 'bg-gray-500',
    icon: PackageX,
  },
};

export function ValuationByCategory({
  categories,
  totalStockValue,
  onCategoryClick,
  onStatusClick,
  onCategoryTotalClick,
  selectedCategoryId,
  selectedStatus,
}: ValuationByCategoryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const calculatePercentage = (value: number) => {
    if (totalStockValue === 0) return 0;
    return (value / totalStockValue) * 100;
  };

  if (categories.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Valorización por Categoría</CardTitle>
          <Badge variant="outline">{categories.length} categorías</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {categories.map((category) => {
            const percentage = calculatePercentage(category.totalValue);

            return (
              <div
                key={category.categoryId}
                className={`rounded-lg border p-4 transition-all ${
                  onCategoryClick ? 'hover:bg-accent/50 hover:border-primary/30 cursor-pointer' : ''
                }`}
                onClick={() => onCategoryClick?.(category.categoryId)}
              >
                {/* Header row */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-sm font-medium">{category.categoryName}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({category.categoryCode})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-base font-bold">
                        {formatCurrency(category.totalValueAtListPrice)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {percentage.toFixed(1)}% del total
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status breakdown */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">Artículos:</span>
                    <button
                      className={`rounded-md px-2 py-0.5 text-xs font-medium transition-all ${
                        onCategoryTotalClick
                          ? 'hover:bg-primary hover:text-primary-foreground cursor-pointer'
                          : ''
                      } ${
                        selectedCategoryId === category.categoryId && selectedStatus === null
                          ? 'bg-primary text-primary-foreground ring-primary/50 ring-2'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCategoryTotalClick?.(category.categoryId);
                      }}
                      title={`Ver todos los artículos de ${category.categoryName}`}
                    >
                      {category.count}
                    </button>
                  </div>

                  {/* Status indicators */}
                  <div className="flex flex-wrap items-center gap-2">
                    {Object.entries(category.byStatus).map(([status, count]) => {
                      if (count === 0) return null;
                      const config = statusConfig[status as StockStatus];
                      const isSelected =
                        selectedCategoryId === category.categoryId && selectedStatus === status;
                      return (
                        <button
                          key={status}
                          className={`flex items-center gap-1 rounded-md px-2 py-1 transition-all ${
                            onStatusClick ? 'hover:bg-accent cursor-pointer' : ''
                          } ${isSelected ? 'bg-accent ring-primary ring-2' : ''}`}
                          title={`Filtrar por ${config.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusClick?.(category.categoryId, status as StockStatus);
                          }}
                        >
                          <div className={`h-2 w-2 rounded-full ${config.color}`} />
                          <span
                            className={`text-xs ${isSelected ? 'font-semibold' : 'text-muted-foreground'}`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Potential sale value */}
                  <div className="ml-auto">
                    <div className="mb-1 text-right">
                      <span className="text-muted-foreground text-xs">Precio Lista: </span>
                      <span className="text-xs font-semibold">
                        {formatCurrency(category.totalValueAtListPrice)}
                      </span>
                    </div>

                    {/* Horizontal scrollable payment terms */}
                    <div className="flex max-w-md items-center gap-2 overflow-x-auto">
                      {category.paymentTermsValuation.map((ptv) => (
                        <div
                          key={ptv.paymentTermId}
                          className="bg-card flex-shrink-0 rounded-md border px-3 py-2"
                        >
                          <div className="text-primary mb-1 text-xs font-medium">
                            {ptv.paymentTermName}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            Desc: {ptv.discountPercent.toFixed(0)}%
                          </div>
                          <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                            {formatCurrency(ptv.stockValueAtDiscountedPrice)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 border-t pt-4">
          <p className="text-muted-foreground mb-2 text-xs">Leyenda de estados:</p>
          <div className="flex flex-wrap items-center gap-4">
            {Object.entries(statusConfig).map(([status, config]) => (
              <div key={status} className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${config.color}`} />
                <span className="text-muted-foreground text-xs">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
