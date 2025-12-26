'use client';

import { SupplierOrderItem } from '@/types/supplierOrder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Trash2, ShoppingCart, AlertTriangle, CheckCircle2, Loader2, Clock, Download } from 'lucide-react';
import { formatSaleTime } from '@/lib/utils/salesCalculations';
import { SparklineWithTooltip } from '@/components/ui/sparkline';

interface SupplierOrderPanelProps {
  items: SupplierOrderItem[];
  totalEstimatedTime: number;
  trendMonths?: number;
  onTrendMonthsChange?: (months: number) => void;
  onQuantityChange: (articleId: number, quantity: number) => void;
  onRemove: (articleId: number) => void;
  onClear: () => void;
  onCreateOrder: () => void;
  isSaving?: boolean;
  isLoading?: boolean;
}

export function SupplierOrderPanel({
  items,
  totalEstimatedTime,
  trendMonths = 12,
  onTrendMonthsChange,
  onQuantityChange,
  onRemove,
  onClear,
  onCreateOrder,
  isSaving = false,
  isLoading = false,
}: SupplierOrderPanelProps) {
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
    const generateSparklineSVG = (data: number[], width: number, height: number, color: string): string => {
      if (!data || data.length === 0) return '';
      
      const max = Math.max(...data, 1);
      const min = Math.min(...data, 0);
      const range = max - min || 1;
      
      const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      }).join(' ');
      
      return `<svg width="${width}" height="${height}" style="display: inline-block; vertical-align: middle;">
        <polyline 
          points="${points}" 
          fill="none" 
          stroke="${color}" 
          stroke-width="2"
        />
      </svg>`;
    };

    // Generate HTML content
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
      background: #f5f5f5;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow-x: auto;
    }
    h1 {
      color: #1f2937;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .subtitle {
      color: #6b7280;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .summary {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
      padding: 20px;
      background: #f9fafb;
      border-radius: 6px;
    }
    .summary-item {
      flex: 1;
    }
    .summary-label {
      color: #6b7280;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    .summary-value {
      color: #1f2937;
      font-size: 24px;
      font-weight: 600;
    }
    table {
      width: 100%;
      min-width: 2000px;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11px;
    }
    th {
      background: #f3f4f6;
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 2px solid #e5e7eb;
      white-space: nowrap;
    }
    th.text-right { text-align: right; }
    td {
      padding: 8px 6px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 11px;
      color: #1f2937;
      white-space: nowrap;
    }
    td.text-right { text-align: right; }
    td.code {
      font-family: 'Courier New', monospace;
      font-weight: 600;
      color: #059669;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-green {
      background: #d1fae5;
      color: #065f46;
    }
    .badge-blue {
      background: #dbeafe;
      color: #1e40af;
    }
    .badge-gray {
      background: #f3f4f6;
      color: #374151;
    }
    .low-stock {
      color: #dc2626;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛒 Pedido a Proveedor</h1>
    <p class="subtitle">Generado el ${new Date().toLocaleString('es-AR', { 
      dateStyle: 'long', 
      timeStyle: 'short' 
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
          <th>Tendencia</th>
          <th class="text-right">Precio Unit.</th>
          <th class="text-right">Prom Simple</th>
          <th class="text-right">Prom 3M</th>
          <th class="text-right">Prom 6M</th>
          <th class="text-right">WMA</th>
          <th class="text-right">EMA</th>
          <th class="text-right">6M+WMA</th>
          <th class="text-right">Mediana</th>
          <th class="text-right">T.Est Simple</th>
          <th class="text-right">T.Est 3M</th>
          <th class="text-right">T.Est 6M</th>
          <th class="text-right">T.Est WMA</th>
          <th class="text-right">T.Est EMA</th>
          <th class="text-right">T.Est 6M+WMA</th>
          <th class="text-right">T.Est Mediana</th>
          <th>Última Venta</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item) => {
          const isLowStock = item.currentStock < item.minimumStock;
          const abcClass = item.article.abcClass || 'C';
          const sparklineColor = abcClass === 'A' ? '#22c55e' : abcClass === 'B' ? '#3b82f6' : '#6b7280';
          const sparklineSVG = item.article.salesTrend && item.article.salesTrend.length > 0
            ? generateSparklineSVG(item.article.salesTrend, 120, 30, sparklineColor)
            : '<span style="color: #9ca3af; font-size: 12px;">Sin datos</span>';
          
          const lastSaleDateFormatted = item.article.lastSaleDate
            ? new Date(item.article.lastSaleDate).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })
            : '<span style="color: #9ca3af; font-size: 12px;">Nunca</span>';
          
          const formatValue = (val?: number) => {
            if (!val || val === 0) return '<span style="color: #9ca3af; font-size: 12px;">0.0</span>';
            return val.toFixed(1);
          };
          
          const formatBadge = (time?: number) => {
            const timeValue = time ?? Infinity;
            const badgeClass = !isFinite(timeValue) || timeValue === 0 ? 'badge-gray' : (abcClass === 'A' ? 'badge-green' : abcClass === 'B' ? 'badge-blue' : 'badge-gray');
            return `<span class="badge ${badgeClass}">${formatSaleTimeLocal(timeValue)}</span>`;
          };
          
          return `
          <tr>
            <td class="code">${item.article.code}</td>
            <td>${item.article.description}</td>
            <td class="text-right"><strong>${item.quantity}</strong></td>
            <td class="text-right ${isLowStock ? 'low-stock' : ''}">${item.currentStock.toFixed(0)}</td>
            <td class="text-right" style="color: #9ca3af;">${item.minimumStock.toFixed(0)}</td>
            <td>${sparklineSVG}</td>
            <td class="text-right"><strong>${formatPrice(item.article.unitPrice)}</strong></td>
            <td class="text-right">${item.avgMonthlySales > 0 ? item.avgMonthlySales.toFixed(1) : '<span style="color: #9ca3af; font-size: 12px;">0.0</span>'}</td>
            <td class="text-right">${formatValue(item.avgSales3Months)}</td>
            <td class="text-right">${formatValue(item.avgSales6Months)}</td>
            <td class="text-right">${formatValue(item.avgSalesWeighted)}</td>
            <td class="text-right">${formatValue(item.avgSalesEma)}</td>
            <td class="text-right">${formatValue(item.avgSalesRecent6Weighted)}</td>
            <td class="text-right">${formatValue(item.avgSalesMedian)}</td>
            <td class="text-right">${formatBadge(item.estimatedSaleTime)}</td>
            <td class="text-right">${formatBadge(item.estTime3Months)}</td>
            <td class="text-right">${formatBadge(item.estTime6Months)}</td>
            <td class="text-right">${formatBadge(item.estTimeWeighted)}</td>
            <td class="text-right">${formatBadge(item.estTimeEma)}</td>
            <td class="text-right">${formatBadge(item.estTimeRecent6Weighted)}</td>
            <td class="text-right">${formatBadge(item.estTimeMedian)}</td>
            <td>${lastSaleDateFormatted}</td>
          </tr>
          `;
        }).join('')}
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
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">No hay artículos seleccionados para el pedido</p>
          <p className="text-xs mt-1">Selecciona artículos de la tabla para agregarlos</p>
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
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Pedido a Proveedor
              {isSaving && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Guardando...
                </span>
              )}
              {!isSaving && !isLoading && items.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-normal">
                  <CheckCircle2 className="h-3 w-3" />
                  Guardado
                </span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">
              {totalItems} artículo{totalItems !== 1 ? 's' : ''} seleccionado{totalItems !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportToHTML} disabled={items.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar HTML
            </Button>
            <Button variant="outline" size="sm" onClick={onClear} disabled={isSaving}>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
            <Button size="sm" onClick={onCreateOrder} disabled={isSaving}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Crear Pedido
            </Button>
          </div>
        </div>

        {/* Trend Months Selector */}
        {onTrendMonthsChange && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Tendencia de ventas:</span>
            <Select value={trendMonths.toString()} onValueChange={(v) => onTrendMonthsChange(parseInt(v))}>
              <SelectTrigger className="w-[140px] h-8">
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

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Stock Actual</TableHead>
                <TableHead className="text-right">Stock Mín.</TableHead>
                <TableHead>Tendencia</TableHead>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">Precio Unit.</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Precio unitario del artículo</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">Prom Simple</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Promedio de ventas mensuales (todos los meses)</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">Prom 3M</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Promedio de ventas de los últimos 3 meses. Muy sensible a cambios recientes.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">Prom 6M</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Promedio de ventas de los últimos 6 meses. Balance entre histórico y actualidad.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">WMA</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Weighted Moving Average: Promedio con más peso a meses recientes (peso lineal creciente).</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">EMA</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Exponential Moving Average: Promedio con decaimiento exponencial. Común en análisis financiero.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">6M+WMA</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Promedio ponderado de los últimos 6 meses. Balance óptimo entre actualidad y estabilidad.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">Mediana</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Valor central de ventas. Muy resistente a picos de venta extremos (outliers).</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">T.Est Simple</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Tiempo estimado para vender la cantidad pedida = Cantidad / Prom Simple</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">T.Est 3M</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Tiempo estimado = Cantidad / Prom 3M</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">T.Est 6M</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Tiempo estimado = Cantidad / Prom 6M</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">T.Est WMA</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Tiempo estimado = Cantidad / WMA</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">T.Est EMA</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Tiempo estimado = Cantidad / EMA</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">T.Est 6M+WMA</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Tiempo estimado = Cantidad / 6M+WMA. Recomendado por su balance.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="text-right cursor-help">T.Est Mediana</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Tiempo estimado = Cantidad / Mediana</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead className="cursor-help">Última Venta</TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Fecha de la última factura emitida que incluye este artículo</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.article.id}>
                  <TableCell className="font-medium font-mono">
                    {item.article.code}
                  </TableCell>
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
                      className="w-24 h-8 text-right"
                      onFocus={(e) => e.target.select()}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        item.currentStock < item.minimumStock
                          ? 'text-red-600 font-semibold'
                          : ''
                      }
                    >
                      {item.currentStock.toFixed(0)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.minimumStock.toFixed(0)}
                  </TableCell>
                  <TableCell>
                    {item.article.salesTrend && item.article.salesTrend.length > 0 ? (
                      <SparklineWithTooltip
                        data={item.article.salesTrend}
                        labels={item.article.salesTrendLabels}
                        width={Math.min(180, Math.max(80, item.article.salesTrend.length * 10))}
                        height={40}
                        color={
                          item.article.abcClass === 'A'
                            ? 'rgb(34, 197, 94)' // green-500
                            : item.article.abcClass === 'B'
                            ? 'rgb(59, 130, 246)' // blue-500
                            : 'rgb(107, 114, 128)' // gray-500
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
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin datos</span>
                    )}
                  </TableCell>
                  
                  {/* Precio Unitario */}
                  <TableCell className="text-right font-medium">
                    {formatPrice(item.article.unitPrice)}
                  </TableCell>
                  
                  {/* Promedio Simple */}
                  <TableCell className="text-right">
                    {item.avgMonthlySales > 0 ? (
                      <span className="text-sm">{item.avgMonthlySales.toFixed(1)}</span>
                    ) : item.article.salesTrend && item.article.salesTrend.length > 0 ? (
                      <span className="text-muted-foreground text-xs">0.0</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  
                  {/* Prom 3M */}
                  <TableCell className="text-right">
                    {(item.avgSales3Months ?? 0) > 0 ? (
                      <span className="text-sm">{item.avgSales3Months!.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">0.0</span>
                    )}
                  </TableCell>
                  
                  {/* Prom 6M */}
                  <TableCell className="text-right">
                    {(item.avgSales6Months ?? 0) > 0 ? (
                      <span className="text-sm">{item.avgSales6Months!.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">0.0</span>
                    )}
                  </TableCell>
                  
                  {/* WMA */}
                  <TableCell className="text-right">
                    {(item.avgSalesWeighted ?? 0) > 0 ? (
                      <span className="text-sm">{item.avgSalesWeighted!.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">0.0</span>
                    )}
                  </TableCell>
                  
                  {/* EMA */}
                  <TableCell className="text-right">
                    {(item.avgSalesEma ?? 0) > 0 ? (
                      <span className="text-sm">{item.avgSalesEma!.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">0.0</span>
                    )}
                  </TableCell>
                  
                  {/* 6M+WMA */}
                  <TableCell className="text-right">
                    {(item.avgSalesRecent6Weighted ?? 0) > 0 ? (
                      <span className="text-sm">{item.avgSalesRecent6Weighted!.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">0.0</span>
                    )}
                  </TableCell>
                  
                  {/* Mediana */}
                  <TableCell className="text-right">
                    {(item.avgSalesMedian ?? 0) > 0 ? (
                      <span className="text-sm">{item.avgSalesMedian!.toFixed(1)}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">0.0</span>
                    )}
                  </TableCell>
                  
                  {/* T.Est Simple */}
                  <TableCell className="text-right">
                    <Badge variant={isFinite(item.estimatedSaleTime) && item.estimatedSaleTime > 0 ? 'secondary' : 'outline'} className="text-xs">
                      {formatSaleTime(item.estimatedSaleTime)}
                    </Badge>
                  </TableCell>
                  
                  {/* T.Est 3M */}
                  <TableCell className="text-right">
                    <Badge variant={isFinite(item.estTime3Months ?? Infinity) && (item.estTime3Months ?? 0) > 0 ? 'secondary' : 'outline'} className="text-xs">
                      {formatSaleTime(item.estTime3Months ?? Infinity)}
                    </Badge>
                  </TableCell>
                  
                  {/* T.Est 6M */}
                  <TableCell className="text-right">
                    <Badge variant={isFinite(item.estTime6Months ?? Infinity) && (item.estTime6Months ?? 0) > 0 ? 'secondary' : 'outline'} className="text-xs">
                      {formatSaleTime(item.estTime6Months ?? Infinity)}
                    </Badge>
                  </TableCell>
                  
                  {/* T.Est WMA */}
                  <TableCell className="text-right">
                    <Badge variant={isFinite(item.estTimeWeighted ?? Infinity) && (item.estTimeWeighted ?? 0) > 0 ? 'secondary' : 'outline'} className="text-xs">
                      {formatSaleTime(item.estTimeWeighted ?? Infinity)}
                    </Badge>
                  </TableCell>
                  
                  {/* T.Est EMA */}
                  <TableCell className="text-right">
                    <Badge variant={isFinite(item.estTimeEma ?? Infinity) && (item.estTimeEma ?? 0) > 0 ? 'secondary' : 'outline'} className="text-xs">
                      {formatSaleTime(item.estTimeEma ?? Infinity)}
                    </Badge>
                  </TableCell>
                  
                  {/* T.Est 6M+WMA */}
                  <TableCell className="text-right">
                    <Badge variant={isFinite(item.estTimeRecent6Weighted ?? Infinity) && (item.estTimeRecent6Weighted ?? 0) > 0 ? 'secondary' : 'outline'} className="text-xs">
                      {formatSaleTime(item.estTimeRecent6Weighted ?? Infinity)}
                    </Badge>
                  </TableCell>
                  
                  {/* T.Est Mediana */}
                  <TableCell className="text-right">
                    <Badge variant={isFinite(item.estTimeMedian ?? Infinity) && (item.estTimeMedian ?? 0) > 0 ? 'secondary' : 'outline'} className="text-xs">
                      {formatSaleTime(item.estTimeMedian ?? Infinity)}
                    </Badge>
                  </TableCell>
                  
                  {/* Última Venta */}
                  <TableCell>
                    {item.article.lastSaleDate ? (
                      <span className="text-sm">
                        {new Date(item.article.lastSaleDate).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nunca</span>
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
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex gap-6">
            <div>
              <div className="text-xs text-muted-foreground">Total Artículos</div>
              <div className="text-lg font-semibold">{totalItems}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Unidades</div>
              <div className="text-lg font-semibold">{totalQuantity}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
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

