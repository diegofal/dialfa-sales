'use client';

import {
  Trash2,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Clock,
  Download,
  Upload,
  ArrowUpDown,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SparklineWithTooltip } from '@/components/ui/sparkline';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  formatSaleTime,
  calculateWeightedAvgSales,
  calculateEstimatedSaleTime,
} from '@/lib/utils/salesCalculations';
import { SupplierOrderItem } from '@/types/supplierOrder';

type ActiveRating = 'GREAT' | 'GOOD' | 'OK' | 'SLOW' | 'NO DATA';

const RATING_CONFIG: Record<
  ActiveRating,
  { label: string; color: string; bg: string; border: string; order: number }
> = {
  GREAT: {
    label: 'Excelente',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    order: 1,
  },
  GOOD: {
    label: 'Bueno',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    order: 2,
  },
  OK: {
    label: 'Regular',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    order: 3,
  },
  SLOW: {
    label: 'Lento',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    order: 4,
  },
  'NO DATA': {
    label: 'Sin datos',
    color: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    order: 5,
  },
};

function getActiveRating(item: SupplierOrderItem): ActiveRating {
  const trend = item.article.activeStockTrend;
  if (!trend || trend.length === 0) return 'NO DATA';
  const wma = calculateWeightedAvgSales(trend, trend.length);
  if (wma <= 0) return 'NO DATA';
  const est = calculateEstimatedSaleTime(item.quantity, wma);
  if (!isFinite(est)) return 'NO DATA';
  if (est <= 12) return 'GREAT';
  if (est <= 24) return 'GOOD';
  if (est <= 60) return 'OK';
  return 'SLOW';
}

interface SupplierOrderPanelProps {
  items: SupplierOrderItem[];
  totalEstimatedTime: number;
  trendMonths?: number;
  onTrendMonthsChange?: (months: number) => void;
  onQuantityChange: (articleId: number, quantity: number) => void;
  onRemove: (articleId: number) => void;
  onClear: () => void;
  onViewOrder?: () => void;
  onImportCsv?: (file: File) => void;
  isSaving?: boolean;
  isLoading?: boolean;
  isImporting?: boolean;
}

export function SupplierOrderPanel({
  items,
  totalEstimatedTime,
  trendMonths = 12,
  onTrendMonthsChange,
  onQuantityChange,
  onRemove,
  onClear,
  onViewOrder,
  onImportCsv,
  isSaving = false,
  isLoading = false,
  isImporting = false,
}: SupplierOrderPanelProps) {
  const [ratingFilter, setRatingFilter] = useState<ActiveRating | 'ALL'>('ALL');
  const [sortByRating, setSortByRating] = useState(false);

  const processedItems = useMemo(() => {
    let result = items.map((item) => ({ ...item, _rating: getActiveRating(item) }));

    if (ratingFilter !== 'ALL') {
      result = result.filter((item) => item._rating === ratingFilter);
    }

    if (sortByRating) {
      result.sort((a, b) => RATING_CONFIG[a._rating].order - RATING_CONFIG[b._rating].order);
    }

    return result;
  }, [items, ratingFilter, sortByRating]);

  const ratingCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: items.length };
    for (const item of items) {
      const r = getActiveRating(item);
      counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [items]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  /**
   * Format sale time in months to a human-readable string
   */
  const formatSaleTimeLocal = (months: number): string => {
    if (!isFinite(months) || months === 0) {
      return '∞ Infinito';
    }

    if (months < 1) {
      const days = Math.round(months * 30);
      return `~${days} días`;
    }

    if (months < 2) {
      return '~1 mes';
    }

    return `~${months.toFixed(1)} meses`;
  };

  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleExportToHTML = () => {
    if (items.length === 0) return;

    // Generate SVG for sparklines
    const generateSparklineSVG = (
      data: number[],
      width: number,
      height: number,
      color: string
    ): string => {
      if (!data || data.length === 0) return '';

      const max = Math.max(...data, 1);
      const min = Math.min(...data, 0);
      const range = max - min || 1;

      const points = data
        .map((value, index) => {
          const x = (index / (data.length - 1)) * width;
          const y = height - ((value - min) / range) * height;
          return `${x},${y}`;
        })
        .join(' ');

      return `<svg width="${width}" height="${height}" style="display: inline-block; vertical-align: middle;">
        <polyline 
          points="${points}" 
          fill="none" 
          stroke="${color}" 
          stroke-width="2"
        />
      </svg>`;
    };

    // Generate HTML content with dark mode
    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pedido a Proveedor - ${new Date().toLocaleDateString('es-AR')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      background: #0a0a0a;
      color: #e5e5e5;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
      background: #171717;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      overflow-x: auto;
    }
    h1 {
      color: #f5f5f5;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .subtitle {
      color: #a3a3a3;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .summary {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
      padding: 20px;
      background: #262626;
      border-radius: 6px;
    }
    .summary-item { flex: 1; }
    .summary-label {
      color: #a3a3a3;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .summary-value {
      color: #f5f5f5;
      font-size: 24px;
      font-weight: 600;
    }
    table {
      width: 100%;
      min-width: 2200px;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11px;
    }
    th {
      background: #262626;
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      color: #a3a3a3;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 2px solid #404040;
      white-space: nowrap;
    }
    th.text-right { text-align: right; }
    th.text-center { text-align: center; }
    td {
      padding: 8px 6px;
      border-bottom: 1px solid #333333;
      font-size: 11px;
      color: #e5e5e5;
      white-space: nowrap;
    }
    td.text-right { text-align: right; }
    td.text-center { text-align: center; }
    td.code {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: #34d399;
    }
    .muted { color: #737373; font-size: 10px; }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-green { background: rgba(16,185,129,0.15); color: #34d399; }
    .badge-blue { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .badge-gray { background: rgba(107,114,128,0.15); color: #9ca3af; }
    .badge-amber { background: rgba(245,158,11,0.15); color: #fbbf24; }
    .badge-emerald { background: rgba(16,185,129,0.15); color: #34d399; }
    .badge-red { background: rgba(239,68,68,0.15); color: #f87171; }
    .low-stock { color: #ef4444; font-weight: 600; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #404040;
      text-align: center;
      color: #737373;
      font-size: 12px;
    }
    @media print {
      body { background: white; color: #1f2937; padding: 0; }
      .container { background: white; box-shadow: none; }
      th { background: #f3f4f6; color: #374151; border-color: #e5e7eb; }
      td { color: #1f2937; border-color: #e5e7eb; }
      td.code { color: #059669; }
      .summary { background: #f9fafb; }
      .summary-value { color: #1f2937; }
      .footer { border-color: #e5e7eb; color: #6b7280; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛒 Pedido a Proveedor</h1>
    <p class="subtitle">Generado el ${new Date().toLocaleString('es-AR', {
      dateStyle: 'long',
      timeStyle: 'short',
    })}</p>

    <div class="summary">
      <div class="summary-item">
        <div class="summary-label">Total Artículos</div>
        <div class="summary-value">${totalItems}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Cantidad Total</div>
        <div class="summary-value">${totalQuantity}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Tiempo Est. Venta</div>
        <div class="summary-value">${formatSaleTime(totalEstimatedTime)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Tendencia</div>
        <div class="summary-value">${trendMonths} meses</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Descripción</th>
          <th class="text-right">Cantidad</th>
          <th class="text-right">Stock Actual</th>
          <th class="text-right">Stock Mín.</th>
          <th>Tendencia (${trendMonths} meses)</th>
          <th>Tend. Activa</th>
          <th class="text-right">Precio Unit.</th>
          <th class="text-right">Prom Ponderado</th>
          <th class="text-right">T. Est. Venta</th>
          <th class="text-right">T. Est. Activa</th>
          <th class="text-center">Clasif.</th>
          <th>Última Venta</th>
        </tr>
      </thead>
      <tbody>
        ${processedItems
          .map((item) => {
            const isLowStock = item.currentStock < item.minimumStock;
            const abcClass = item.article.abcClass || 'C';
            const sparklineColor =
              abcClass === 'A' ? '#22c55e' : abcClass === 'B' ? '#3b82f6' : '#6b7280';
            const sparklineSVG =
              item.article.salesTrend && item.article.salesTrend.length > 0
                ? generateSparklineSVG(item.article.salesTrend, 120, 30, sparklineColor)
                : '<span class="muted">Sin datos</span>';

            const activeSparklineSVG =
              item.article.activeStockTrend && item.article.activeStockTrend.length > 0
                ? generateSparklineSVG(item.article.activeStockTrend, 120, 30, '#f59e0b')
                : '<span class="muted">= completa</span>';

            const activeWma = item.article.activeStockTrend?.length
              ? calculateWeightedAvgSales(
                  item.article.activeStockTrend,
                  item.article.activeStockTrend.length
                )
              : 0;
            const activeEstTime =
              activeWma > 0 ? calculateEstimatedSaleTime(item.quantity, activeWma) : Infinity;

            const rating = getActiveRating(item);
            const ratingCfg = RATING_CONFIG[rating];
            const ratingBadgeClass =
              rating === 'GREAT'
                ? 'badge-emerald'
                : rating === 'GOOD'
                  ? 'badge-blue'
                  : rating === 'OK'
                    ? 'badge-amber'
                    : rating === 'SLOW'
                      ? 'badge-red'
                      : 'badge-gray';

            const lastSaleDateFormatted = item.article.lastSaleDate
              ? new Date(item.article.lastSaleDate).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : '<span class="muted">Nunca</span>';

            const formatBadge = (time: number, badgeClass: string) => {
              return `<span class="badge ${badgeClass}">${formatSaleTimeLocal(time)}</span>`;
            };

            const estBadgeClass =
              !isFinite(item.estimatedSaleTime) || item.estimatedSaleTime === 0
                ? 'badge-gray'
                : abcClass === 'A'
                  ? 'badge-green'
                  : abcClass === 'B'
                    ? 'badge-blue'
                    : 'badge-gray';

            const activeEstBadgeClass =
              !isFinite(activeEstTime) || activeEstTime === 0 ? 'badge-gray' : 'badge-amber';

            return `
          <tr>
            <td class="code">${item.article.code}</td>
            <td>${item.article.description}</td>
            <td class="text-right"><strong>${item.quantity}</strong></td>
            <td class="text-right ${isLowStock ? 'low-stock' : ''}">${item.currentStock.toFixed(0)}</td>
            <td class="text-right muted">${item.minimumStock.toFixed(0)}</td>
            <td>${sparklineSVG}</td>
            <td>${activeSparklineSVG}</td>
            <td class="text-right"><strong>${formatPrice(item.article.unitPrice)}</strong></td>
            <td class="text-right">${item.avgMonthlySales > 0 ? item.avgMonthlySales.toFixed(1) : '<span class="muted">-</span>'}</td>
            <td class="text-right">${formatBadge(item.estimatedSaleTime, estBadgeClass)}</td>
            <td class="text-right">${item.article.activeStockTrend?.length ? formatBadge(activeEstTime, activeEstBadgeClass) : '<span class="muted">-</span>'}</td>
            <td class="text-center"><span class="badge ${ratingBadgeClass}">${ratingCfg.label}</span></td>
            <td>${lastSaleDateFormatted}</td>
          </tr>
          `;
          })
          .join('')}
      </tbody>
    </table>

    <div class="footer">
      <p><strong>SPISA</strong> - Sistema de Gestión de Inventario y Ventas</p>
      <p>Documento generado automáticamente • No requiere firma</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Create and download file
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `pedido-proveedor-${timestamp}.html`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (items.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center">
          <ShoppingCart className="mb-3 h-12 w-12 opacity-30" />
          <p className="text-sm">No hay artículos seleccionados para el pedido</p>
          <p className="mt-1 text-xs">Selecciona artículos de la tabla para agregarlos</p>
          {onImportCsv && (
            <div className="mt-4">
              <input
                type="file"
                accept=".csv"
                className="hidden"
                id="csv-import-input-empty"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onImportCsv(file);
                    e.target.value = '';
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={isImporting}
                onClick={() => document.getElementById('csv-import-input-empty')?.click()}
              >
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Importar CSV
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <ShoppingCart className="h-5 w-5" />
              Pedido a Proveedor
              {isSaving && (
                <span className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Guardando...
                </span>
              )}
              {!isSaving && !isLoading && items.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-normal text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  Guardado
                </span>
              )}
            </h3>
            <p className="text-muted-foreground text-sm">
              {totalItems} artículo{totalItems !== 1 ? 's' : ''} seleccionado
              {totalItems !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            {onImportCsv && (
              <>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="csv-import-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onImportCsv(file);
                      e.target.value = '';
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isImporting || isSaving}
                  onClick={() => document.getElementById('csv-import-input')?.click()}
                >
                  {isImporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Importar CSV
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportToHTML}
              disabled={items.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar HTML
            </Button>
            <Button variant="outline" size="sm" onClick={onClear} disabled={isSaving}>
              <Trash2 className="mr-2 h-4 w-4" />
              Limpiar
            </Button>
            {onViewOrder && (
              <Button size="sm" variant="outline" onClick={onViewOrder} disabled={isSaving}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Ver Pedido
              </Button>
            )}
          </div>
        </div>

        {/* Trend Months Selector */}
        {onTrendMonthsChange && (
          <div className="bg-muted/50 flex items-center gap-2 rounded-lg p-3">
            <Clock className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-medium">Tendencia de ventas:</span>
            <Select
              value={trendMonths.toString()}
              onValueChange={(v) => onTrendMonthsChange(parseInt(v))}
            >
              <SelectTrigger className="h-8 w-[140px]">
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
        )}

        {/* Rating Filter */}
        {items.length > 0 && (
          <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg p-3">
            <span className="text-sm font-medium">Clasificación activa:</span>
            {(['ALL', 'GREAT', 'GOOD', 'OK', 'SLOW', 'NO DATA'] as const).map((r) => {
              const isActive = ratingFilter === r;
              const count = ratingCounts[r] || 0;
              if (r !== 'ALL' && count === 0) return null;
              const cfg = r === 'ALL' ? null : RATING_CONFIG[r];
              return (
                <Button
                  key={r}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className={`h-7 text-xs ${!isActive && cfg ? `${cfg.color} ${cfg.bg} ${cfg.border}` : ''}`}
                  onClick={() => setRatingFilter(r)}
                >
                  {r === 'ALL' ? 'Todos' : cfg!.label} ({count})
                </Button>
              );
            })}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Stock Actual</TableHead>
                <TableHead className="text-right">Stock Mín.</TableHead>
                <TableHead>Tendencia ({trendMonths} meses)</TableHead>
                <TableHead>Tend. Activa</TableHead>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="cursor-help text-right">Precio Unit.</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Precio unitario del artículo</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="cursor-help text-right">Prom Ponderado</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Promedio ponderado de ventas (WMA) sobre los últimos {trendMonths} meses. Da
                        más peso a los meses recientes. Recomendado por análisis estadístico.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="cursor-help text-right">T. Est. Venta</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Tiempo estimado para vender la cantidad pedida = Cantidad / Prom Ponderado
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="cursor-help text-right">T. Est. Activa</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Tiempo estimado usando el mejor período histórico de actividad
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead
                        className="cursor-pointer text-center"
                        onClick={() => setSortByRating(!sortByRating)}
                      >
                        Clasif. <ArrowUpDown className="ml-1 inline h-3 w-3" />
                      </TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Clasificación basada en T. Est. Activa: Excelente (≤1a), Bueno (1-2a),
                        Regular (2-5a), Lento (&gt;5a). Click para ordenar.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="cursor-help">Última Venta</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Fecha de la última factura emitida que incluye este artículo
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedItems.map((item) => (
                <TableRow key={item.article.id}>
                  <TableCell className="font-mono font-medium">{item.article.code}</TableCell>
                  <TableCell>
                    <div className="max-w-md truncate">{item.article.description}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const newQty = parseInt(e.target.value) || 1;
                        onQuantityChange(item.article.id, newQty);
                      }}
                      className="h-8 w-24 text-right"
                      onFocus={(e) => e.target.select()}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        item.currentStock < item.minimumStock ? 'font-semibold text-red-600' : ''
                      }
                    >
                      {item.currentStock.toFixed(0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {item.minimumStock.toFixed(0)}
                  </TableCell>
                  <TableCell>
                    {item.article.salesTrend && item.article.salesTrend.length > 0 ? (
                      <div className="flex flex-col">
                        <SparklineWithTooltip
                          data={item.article.salesTrend}
                          labels={item.article.salesTrendLabels}
                          width={Math.min(180, Math.max(80, item.article.salesTrend.length * 10))}
                          height={40}
                          color={
                            item.article.abcClass === 'A'
                              ? 'rgb(34, 197, 94)'
                              : item.article.abcClass === 'B'
                                ? 'rgb(59, 130, 246)'
                                : 'rgb(107, 114, 128)'
                          }
                          fillColor={
                            item.article.abcClass === 'A'
                              ? 'rgba(34, 197, 94, 0.1)'
                              : item.article.abcClass === 'B'
                                ? 'rgba(59, 130, 246, 0.1)'
                                : 'rgba(107, 114, 128, 0.1)'
                          }
                          formatValue={(v) => `${v} unidades`}
                        />
                        {item.article.salesTrendLabels &&
                          item.article.salesTrendLabels.length > 0 && (
                            <span className="text-muted-foreground text-[10px]">
                              {item.article.salesTrendLabels[0]} -{' '}
                              {
                                item.article.salesTrendLabels[
                                  item.article.salesTrendLabels.length - 1
                                ]
                              }
                            </span>
                          )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Sin datos</span>
                    )}
                  </TableCell>

                  {/* Tendencia Activa */}
                  <TableCell>
                    {item.article.activeStockTrend && item.article.activeStockTrend.length > 0 ? (
                      <div className="flex flex-col">
                        <SparklineWithTooltip
                          data={item.article.activeStockTrend}
                          labels={item.article.activeStockTrendLabels}
                          width={Math.min(
                            180,
                            Math.max(80, item.article.activeStockTrend.length * 15)
                          )}
                          height={40}
                          color="rgb(245, 158, 11)"
                          fillColor="rgba(245, 158, 11, 0.1)"
                          formatValue={(v) => `${v} unidades`}
                        />
                        <span className="text-muted-foreground text-[10px]">
                          {item.article.activeStockTrendLabels?.[0]} -{' '}
                          {
                            item.article.activeStockTrendLabels?.[
                              item.article.activeStockTrendLabels.length - 1
                            ]
                          }{' '}
                          ({item.article.activeStockMonths}m)
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">= completa</span>
                    )}
                  </TableCell>

                  {/* Precio Unitario */}
                  <TableCell className="text-right font-medium">
                    {formatPrice(item.article.unitPrice)}
                  </TableCell>

                  {/* Prom Ponderado (WMA) */}
                  <TableCell className="text-right">
                    {item.avgMonthlySales > 0 ? (
                      <Badge variant="outline" className="text-xs">
                        {item.avgMonthlySales.toFixed(1)}
                      </Badge>
                    ) : item.article.salesTrend && item.article.salesTrend.length > 0 ? (
                      <span className="text-muted-foreground text-xs">0.0</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>

                  {/* T. Est. Venta */}
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        isFinite(item.estimatedSaleTime) && item.estimatedSaleTime > 0
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-xs"
                    >
                      {formatSaleTime(item.estimatedSaleTime)}
                    </Badge>
                  </TableCell>

                  {/* T. Est. Venta (Activa) */}
                  <TableCell className="text-right">
                    {item.article.activeStockTrend && item.article.activeStockTrend.length > 0 ? (
                      (() => {
                        const activeWma = calculateWeightedAvgSales(
                          item.article.activeStockTrend,
                          item.article.activeStockTrend.length
                        );
                        const activeEstTime = calculateEstimatedSaleTime(item.quantity, activeWma);
                        return (
                          <Badge
                            variant={
                              isFinite(activeEstTime) && activeEstTime > 0 ? 'secondary' : 'outline'
                            }
                            className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400"
                          >
                            {formatSaleTime(activeEstTime)}
                          </Badge>
                        );
                      })()
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>

                  {/* Clasificación */}
                  <TableCell className="text-center">
                    {(() => {
                      const cfg = RATING_CONFIG[item._rating];
                      return (
                        <Badge
                          variant="outline"
                          className={`text-xs ${cfg.color} ${cfg.bg} ${cfg.border}`}
                        >
                          {cfg.label}
                        </Badge>
                      );
                    })()}
                  </TableCell>

                  {/* Última Venta */}
                  <TableCell>
                    {item.article.lastSaleDate ? (
                      <span className="text-sm">
                        {new Date(item.article.lastSaleDate).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Nunca</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onRemove(item.article.id)}
                      title="Quitar"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Footer with totals */}
        <div className="flex items-center justify-between border-t pt-2">
          <div className="flex gap-6">
            <div>
              <div className="text-muted-foreground text-xs">Total Artículos</div>
              <div className="text-lg font-semibold">{totalItems}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Total Unidades</div>
              <div className="text-lg font-semibold">{totalQuantity}</div>
            </div>
            <div>
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                Tiempo Prom. Est. Venta
                {!isFinite(totalEstimatedTime) && (
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                )}
              </div>
              <div className="text-lg font-semibold">
                <Badge variant="secondary" className="text-sm">
                  {formatSaleTime(totalEstimatedTime)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
