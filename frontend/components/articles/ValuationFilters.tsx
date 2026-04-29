import { RefreshCw, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StockClassificationConfig, StockStatus } from '@/types/stockValuation';

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
        <div className="mb-4 border-b pb-4">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="trendMonthsDisplay"
                className="flex items-center gap-1 text-sm font-semibold"
              >
                Período de Tendencia (Gráficos)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
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
          <p className="text-muted-foreground mb-3 text-sm font-semibold">
            Configuración de Clasificación
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Active Recency */}
          <div className="space-y-2">
            <Label htmlFor="activeThreshold" className="flex items-center gap-1 text-xs">
              Recencia Activo (días)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Recencia máxima de la última venta para que un artículo sea Activo.
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

          {/* Min Months for Active (frequency-based) */}
          <div className="space-y-2">
            <Label htmlFor="minMonthsActive" className="flex items-center gap-1 text-xs">
              Meses Activos (de últ. 3)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Mínimo de meses con ventas (de los últimos 3) para calificar como Activo.
                      Frecuencia, no cantidad: 1 venta cuenta igual que 100.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={(config.minMonthsForActive ?? 2).toString()}
              onValueChange={(v) => handleThresholdChange('minMonthsForActive', v)}
            >
              <SelectTrigger id="minMonthsActive">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mes</SelectItem>
                <SelectItem value="2">2 meses</SelectItem>
                <SelectItem value="3">3 meses (estricto)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Min Months for Leaving Dead */}
          <div className="space-y-2">
            <Label htmlFor="minMonthsLeavingDead" className="flex items-center gap-1 text-xs">
              Meses para salir de Muerto
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Mínimo de meses con ventas (en la ventana de inactividad) para que un artículo
                      deje de ser Muerto. Una sola venta no alcanza.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={(config.minMonthsForLeavingDead ?? 2).toString()}
              onValueChange={(v) => handleThresholdChange('minMonthsForLeavingDead', v)}
            >
              <SelectTrigger id="minMonthsLeavingDead">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 mes (permisivo)</SelectItem>
                <SelectItem value="2">2 meses</SelectItem>
                <SelectItem value="3">3 meses</SelectItem>
                <SelectItem value="4">4 meses (estricto)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dead Stock Inactivity Window */}
          <div className="space-y-2">
            <Label htmlFor="deadWindow" className="flex items-center gap-1 text-xs">
              Ventana de inactividad
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Cantidad de meses pasados en los que se busca evidencia de actividad. La regla
                      &quot;Meses para salir de Muerto&quot; se aplica sobre esta ventana.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={(config.deadStockNoActivityWindowMonths ?? 12).toString()}
              onValueChange={(v) => handleThresholdChange('deadStockNoActivityWindowMonths', v)}
            >
              <SelectTrigger id="deadWindow">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="9">9 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="18">18 meses</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Incluir Sin Stock */}
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="includeZeroStock" className="cursor-pointer text-sm">
                Incluir artículos sin stock
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
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
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Recalculando...' : 'Recalcular Ahora'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
