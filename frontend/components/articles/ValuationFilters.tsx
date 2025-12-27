import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Info } from 'lucide-react';
import { StockClassificationConfig, StockStatus } from '@/types/stockValuation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ValuationFiltersProps {
  config: StockClassificationConfig;
  onConfigChange: (config: StockClassificationConfig) => void;
  selectedStatus: StockStatus | 'all';
  onStatusChange: (status: StockStatus | 'all') => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  cacheAge?: string | null;
  trendMonths: number;
  onTrendMonthsChange: (months: number) => void;
}

export function ValuationFilters({
  config,
  onConfigChange,
  selectedStatus,
  onStatusChange,
  onRefresh,
  isRefreshing,
  cacheAge,
  trendMonths,
  onTrendMonthsChange,
}: ValuationFiltersProps) {
  
  const handleThresholdChange = (field: keyof StockClassificationConfig, value: string) => {
    onConfigChange({
      ...config,
      [field]: parseInt(value),
    });
  };

  const handleIncludeZeroStockChange = (checked: boolean) => {
    onConfigChange({
      ...config,
      includeZeroStock: checked,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Configuración y Filtros</CardTitle>
          {cacheAge && (
            <Badge variant="outline" className="text-xs">
              Calculado hace {cacheAge}h
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Trend Configuration */}
        <div className="mb-4 pb-4 border-b">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label htmlFor="trendMonthsDisplay" className="text-sm font-semibold flex items-center gap-1">
                Período de Tendencia (Gráficos)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Meses históricos para mostrar en los gráficos sparkline
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Select
                value={trendMonths.toString()}
                onValueChange={(v) => onTrendMonthsChange(parseInt(v))}
              >
                <SelectTrigger id="trendMonthsDisplay" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="18">18 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="statusFilter" className="text-sm font-semibold">
                Filtrar por Estado
              </Label>
              <Select
                value={selectedStatus}
                onValueChange={(v) => onStatusChange(v as StockStatus | 'all')}
              >
                <SelectTrigger id="statusFilter" className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value={StockStatus.DEAD_STOCK}>Stock Muerto</SelectItem>
                  <SelectItem value={StockStatus.SLOW_MOVING}>Movimiento Lento</SelectItem>
                  <SelectItem value={StockStatus.ACTIVE}>Activo</SelectItem>
                  <SelectItem value={StockStatus.NEVER_SOLD}>Nunca Vendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Classification Configuration */}
        <div className="mb-2">
          <p className="text-sm font-semibold text-muted-foreground mb-3">Configuración de Clasificación</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Active Threshold */}
          <div className="space-y-2">
            <Label htmlFor="activeThreshold" className="text-xs flex items-center gap-1">
              Activo (días)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      Artículos con venta reciente dentro de este período
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={config.activeThresholdDays.toString()}
              onValueChange={(v) => handleThresholdChange('activeThresholdDays', v)}
            >
              <SelectTrigger id="activeThreshold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 días</SelectItem>
                <SelectItem value="60">60 días</SelectItem>
                <SelectItem value="90">90 días</SelectItem>
                <SelectItem value="120">120 días</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Slow Moving Threshold */}
          <div className="space-y-2">
            <Label htmlFor="slowThreshold" className="text-xs flex items-center gap-1">
              Lento (días)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      Artículos con ventas esporádicas o bajas
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={config.slowMovingThresholdDays.toString()}
              onValueChange={(v) => handleThresholdChange('slowMovingThresholdDays', v)}
            >
              <SelectTrigger id="slowThreshold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="90">90 días</SelectItem>
                <SelectItem value="120">120 días</SelectItem>
                <SelectItem value="180">180 días</SelectItem>
                <SelectItem value="240">240 días</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dead Stock Threshold */}
          <div className="space-y-2">
            <Label htmlFor="deadThreshold" className="text-xs flex items-center gap-1">
              Muerto (días)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      Artículos sin ventas por período prolongado
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={config.deadStockThresholdDays.toString()}
              onValueChange={(v) => handleThresholdChange('deadStockThresholdDays', v)}
            >
              <SelectTrigger id="deadThreshold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="180">180 días</SelectItem>
                <SelectItem value="270">270 días</SelectItem>
                <SelectItem value="365">365 días</SelectItem>
                <SelectItem value="540">540 días</SelectItem>
                <SelectItem value="730">730 días (2 años)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Min Sales for Active */}
          <div className="space-y-2">
            <Label htmlFor="minSales" className="text-xs flex items-center gap-1">
              Ventas Mín/Mes
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      Mínimo de unidades vendidas por mes para considerarse activo
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={config.minSalesForActive.toString()}
              onValueChange={(v) => handleThresholdChange('minSalesForActive', v)}
            >
              <SelectTrigger id="minSales">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 unidad</SelectItem>
                <SelectItem value="3">3 unidades</SelectItem>
                <SelectItem value="5">5 unidades</SelectItem>
                <SelectItem value="10">10 unidades</SelectItem>
                <SelectItem value="20">20 unidades</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Trend Months for Classification */}
          <div className="space-y-2">
            <Label htmlFor="trendMonths" className="text-xs flex items-center gap-1">
              Período Clasificación
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      Meses para calcular promedios de ventas y clasificación
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={config.trendMonths.toString()}
              onValueChange={(v) => handleThresholdChange('trendMonths', v)}
            >
              <SelectTrigger id="trendMonths">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 meses</SelectItem>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="18">18 meses</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Incluir Sin Stock */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="includeZeroStock" className="text-sm cursor-pointer">
                Incluir artículos sin stock
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      Mostrar también artículos con stock = 0 (valor siempre será $0)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id="includeZeroStock"
              checked={config.includeZeroStock}
              onCheckedChange={handleIncludeZeroStockChange}
            />
          </div>
        </div>

        {/* Refresh Button */}
        {onRefresh && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Recalculando...' : 'Recalcular Ahora'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

