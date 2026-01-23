import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ClientClassificationConfig } from '@/types/clientClassification';

interface ClientClassificationFiltersProps {
  config: ClientClassificationConfig;
  onConfigChange: (config: ClientClassificationConfig) => void;
  cacheAge?: string | null;
  trendMonths: number;
  onTrendMonthsChange: (months: number) => void;
}

export function ClientClassificationFilters({
  config,
  onConfigChange,
  cacheAge,
  trendMonths,
  onTrendMonthsChange,
}: ClientClassificationFiltersProps) {
  const handleThresholdChange = (field: keyof ClientClassificationConfig, value: string) => {
    onConfigChange({
      ...config,
      [field]: parseInt(value),
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Configuración de Clasificación</CardTitle>
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
                      Meses históricos para mostrar en los gráficos de tendencia de facturación
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
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="18">18 meses</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Classification Configuration */}
        <div className="mb-2">
          <p className="text-muted-foreground mb-3 text-sm font-semibold">
            Umbrales de Clasificación
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Active Threshold */}
          <div className="space-y-2">
            <Label htmlFor="activeThreshold" className="flex items-center gap-1 text-xs">
              Activo (días)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Clientes con compra reciente dentro de este período
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
            <Label htmlFor="slowThreshold" className="flex items-center gap-1 text-xs">
              Lento (días)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">Clientes con compras esporádicas</p>
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

          {/* Inactive Threshold */}
          <div className="space-y-2">
            <Label htmlFor="inactiveThreshold" className="flex items-center gap-1 text-xs">
              Inactivo (días)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">Clientes sin compras por período prolongado</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={config.inactiveThresholdDays.toString()}
              onValueChange={(v) => handleThresholdChange('inactiveThresholdDays', v)}
            >
              <SelectTrigger id="inactiveThreshold">
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

          {/* Min Purchases Per Month */}
          <div className="space-y-2">
            <Label htmlFor="minPurchases" className="flex items-center gap-1 text-xs">
              Compras Mín/Mes
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Mínimo de compras por mes para scoring de frecuencia
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={config.minPurchasesPerMonth.toString()}
              onValueChange={(v) => handleThresholdChange('minPurchasesPerMonth', v)}
            >
              <SelectTrigger id="minPurchases">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 compra</SelectItem>
                <SelectItem value="2">2 compras</SelectItem>
                <SelectItem value="3">3 compras</SelectItem>
                <SelectItem value="5">5 compras</SelectItem>
                <SelectItem value="10">10 compras</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
