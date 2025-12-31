import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CategoryValuationData, StockStatus } from '@/types/stockValuation';
import { Progress } from '@/components/ui/progress';
import { Activity, TrendingDown, PackageX } from 'lucide-react';

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
                className={`p-4 rounded-lg border transition-all ${
                  onCategoryClick 
                    ? 'cursor-pointer hover:bg-accent/50 hover:border-primary/30' 
                    : ''
                }`}
                onClick={() => onCategoryClick?.(category.categoryId)}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-medium text-sm">{category.categoryName}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({category.categoryCode})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-base">{formatCurrency(category.totalValue)}</p>
                      <p className="text-xs text-muted-foreground">
                        {percentage.toFixed(1)}% del total
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <Progress 
                  value={percentage} 
                  className="h-2 mb-3"
                />

                {/* Status breakdown */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Artículos:</span>
                    <button
                      className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all ${
                        onCategoryTotalClick ? 'hover:bg-primary hover:text-primary-foreground cursor-pointer' : ''
                      } ${
                        selectedCategoryId === category.categoryId && selectedStatus === null 
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary/50' 
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
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.entries(category.byStatus).map(([status, count]) => {
                      if (count === 0) return null;
                      const config = statusConfig[status as StockStatus];
                      const isSelected = selectedCategoryId === category.categoryId && 
                                        selectedStatus === status;
                      return (
                        <button 
                          key={status} 
                          className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                            onStatusClick ? 'hover:bg-accent cursor-pointer' : ''
                          } ${isSelected ? 'bg-accent ring-2 ring-primary' : ''}`}
                          title={`Filtrar por ${config.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusClick?.(category.categoryId, status as StockStatus);
                          }}
                        >
                          <div className={`w-2 h-2 rounded-full ${config.color}`} />
                          <span className={`text-xs ${isSelected ? 'font-semibold' : 'text-muted-foreground'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Potential sale value */}
                  <div className="ml-auto">
                    <div className="text-right mb-1">
                      <span className="text-xs text-muted-foreground">Precio Lista: </span>
                      <span className="text-xs font-semibold">
                        {formatCurrency(category.totalValueAtListPrice)}
                      </span>
                    </div>
                    
                    {/* Horizontal scrollable payment terms */}
                    <div className="flex items-center gap-2 overflow-x-auto max-w-md">
                      {category.paymentTermsValuation.map((ptv) => (
                        <div 
                          key={ptv.paymentTermId} 
                          className="flex-shrink-0 border rounded-md px-3 py-2 bg-card"
                        >
                          <div className="text-xs font-medium text-primary mb-1">
                            {ptv.paymentTermName}
                          </div>
                          <div className="text-xs text-muted-foreground">
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
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Leyenda de estados:</p>
          <div className="flex items-center gap-4 flex-wrap">
            {Object.entries(statusConfig).map(([status, config]) => (
              <div key={status} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${config.color}`} />
                <span className="text-xs text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

