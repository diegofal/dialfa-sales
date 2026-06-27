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
  ArrowUp,
  ArrowDown,
  Container,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
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
import { type FillMode } from '@/lib/utils/articles/containerFill';
import { getArticleCifCost } from '@/lib/utils/articles/marginCalculations';
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

/** Selectable container capacities (kg). 25 t is the default standard container. */
const CONTAINER_CAPACITIES_KG = [20000, 25000, 28000] as const;
const DEFAULT_CONTAINER_KG = 25000;
/** Months of projected demand the auto-fill aims to cover. */
const COVERAGE_MONTHS_OPTIONS = [3, 6, 12, 18] as const;
const DEFAULT_COVERAGE_MONTHS = 12;

/** How the auto-fill prioritizes and sizes what it brings. */
export interface FillOptions {
  remainingKg: number;
  capacityKg: number;
  coverageMonths: number;
  mode: FillMode;
  excludeNoRotation: boolean;
  /** Max months of stock to hold per item (0 = no cap). */
  maxStockMonths: number;
  /** Max distinct lines; undefined = no limit. */
  maxSkus?: number;
  /** Selected category ids; empty = all. */
  categoryIds: number[];
}
/** Item-limit slider bounds; the max value means "no limit". */
const ITEM_LIMIT_MIN = 10;
const ITEM_LIMIT_MAX = 100;
const ITEM_LIMIT_STEP = 5;
const FILL_MODES: { key: FillMode; label: string }[] = [
  { key: 'money', label: '💰 Plata' },
  { key: 'rotation', label: '🔥 Rotación' },
  { key: 'critical', label: '🚨 Crítico' },
];
/** Over-stock cap options (months); 0 = "Sin tope". Default: no cap (fill the box). */
const MAX_STOCK_MONTHS_OPTIONS = [0, 12, 24, 36] as const;
const DEFAULT_MAX_STOCK_MONTHS = 0;

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
  /**
   * Build / top up the container. Receives the free kg in the current container,
   * the capacity, the coverage period, and the strategy options (mode + filters).
   */
  onFillContainer?: (options: FillOptions) => void;
  /** Categories for the auto-fill category filter. */
  categories?: { id: number; name: string }[];
  isSaving?: boolean;
  isLoading?: boolean;
  isImporting?: boolean;
  isFilling?: boolean;
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
  onFillContainer,
  categories = [],
  isSaving = false,
  isLoading = false,
  isImporting = false,
  isFilling = false,
}: SupplierOrderPanelProps) {
  const [ratingFilter, setRatingFilter] = useState<ActiveRating | 'ALL'>('ALL');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);
  const [containerCapacityKg, setContainerCapacityKg] = useState<number>(DEFAULT_CONTAINER_KG);
  const [coverageMonths, setCoverageMonths] = useState<number>(DEFAULT_COVERAGE_MONTHS);
  const [fillMode, setFillMode] = useState<FillMode>('money');
  const [excludeNoRotation, setExcludeNoRotation] = useState<boolean>(true);
  const [maxStockMonths, setMaxStockMonths] = useState<number>(DEFAULT_MAX_STOCK_MONTHS);
  const [itemLimit, setItemLimit] = useState<number>(ITEM_LIMIT_MAX); // MAX = sin límite
  const [fillCategoryIds, setFillCategoryIds] = useState<number[]>([]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDesc) {
        setSortKey(null);
        setSortDesc(false);
      } else {
        setSortDesc(true);
      }
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
  };

  const processedItems = useMemo(() => {
    let result = items.map((item) => ({ ...item, _rating: getActiveRating(item) }));

    if (ratingFilter !== 'ALL') {
      result = result.filter((item) => item._rating === ratingFilter);
    }

    if (sortKey) {
      const dir = sortDesc ? -1 : 1;
      result.sort((a, b) => {
        let aVal: number | string = 0;
        let bVal: number | string = 0;
        switch (sortKey) {
          case 'Code':
            return a.article.code.localeCompare(b.article.code) * dir;
          case 'Description':
            return a.article.description.localeCompare(b.article.description) * dir;
          case 'Quantity':
            aVal = a.quantity;
            bVal = b.quantity;
            break;
          case 'Weight':
            aVal = (Number(a.article.weightKg) || 0) * a.quantity;
            bVal = (Number(b.article.weightKg) || 0) * b.quantity;
            break;
          case 'Stock':
            aVal = a.currentStock;
            bVal = b.currentStock;
            break;
          case 'MinStock':
            aVal = a.minimumStock;
            bVal = b.minimumStock;
            break;
          case 'Price':
            aVal = a.article.unitPrice;
            bVal = b.article.unitPrice;
            break;
          case 'WMA':
            aVal = a.avgMonthlySales;
            bVal = b.avgMonthlySales;
            break;
          case 'EstTime':
            aVal = isFinite(a.estimatedSaleTime) ? a.estimatedSaleTime : 999999;
            bVal = isFinite(b.estimatedSaleTime) ? b.estimatedSaleTime : 999999;
            break;
          case 'ActiveEstTime': {
            const aWma = a.article.activeStockTrend?.length
              ? calculateWeightedAvgSales(
                  a.article.activeStockTrend,
                  a.article.activeStockTrend.length
                )
              : 0;
            const bWma = b.article.activeStockTrend?.length
              ? calculateWeightedAvgSales(
                  b.article.activeStockTrend,
                  b.article.activeStockTrend.length
                )
              : 0;
            aVal = aWma > 0 ? calculateEstimatedSaleTime(a.quantity, aWma) : 999999;
            bVal = bWma > 0 ? calculateEstimatedSaleTime(b.quantity, bWma) : 999999;
            if (!isFinite(aVal)) aVal = 999999;
            if (!isFinite(bVal)) bVal = 999999;
            break;
          }
          case 'Rating':
            aVal = RATING_CONFIG[a._rating].order;
            bVal = RATING_CONFIG[b._rating].order;
            break;
          case 'LastSale': {
            aVal = a.article.lastSaleDate ? new Date(a.article.lastSaleDate).getTime() : 0;
            bVal = b.article.lastSaleDate ? new Date(b.article.lastSaleDate).getTime() : 0;
            break;
          }
        }
        return ((aVal as number) - (bVal as number)) * dir;
      });
    }

    return result;
  }, [items, ratingFilter, sortKey, sortDesc]);

  const ratingCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: items.length };
    for (const item of items) {
      const r = getActiveRating(item);
      counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [items]);

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
    return sortDesc ? (
      <ArrowDown className="text-primary ml-1 inline h-3 w-3" />
    ) : (
      <ArrowUp className="text-primary ml-1 inline h-3 w-3" />
    );
  };

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

  // Container / tonnage planning
  const lineWeightKg = (item: SupplierOrderItem) =>
    (Number(item.article.weightKg) || 0) * item.quantity;
  const totalWeightKg = items.reduce((sum, item) => sum + lineWeightKg(item), 0);
  const itemsMissingWeight = items.filter((item) => !(Number(item.article.weightKg) > 0)).length;
  const containersNeeded = totalWeightKg > 0 ? Math.ceil(totalWeightKg / containerCapacityKg) : 0;
  // Fill % of the *current* (last) container being filled
  const currentContainerKg =
    containersNeeded <= 1
      ? totalWeightKg
      : totalWeightKg - (containersNeeded - 1) * containerCapacityKg;
  const currentFillPct = Math.min(100, (currentContainerKg / containerCapacityKg) * 100);
  const remainingInContainerKg = Math.max(0, containerCapacityKg - currentContainerKg);
  const formatKg = (kg: number) =>
    kg >= 1000 ? `${(kg / 1000).toFixed(2)} t` : `${kg.toFixed(0)} kg`;

  // Container cost from stored prices (CIF landed cost = FOB × (1 + CIF%), USD)
  const lineCifCost = (item: SupplierOrderItem) => {
    const cif = getArticleCifCost(item.article);
    return cif !== null ? cif * item.quantity : 0;
  };
  const totalCifCost = items.reduce((sum, item) => sum + lineCifCost(item), 0);
  const totalFobCost = items.reduce(
    (sum, item) => sum + (Number(item.article.lastPurchasePrice) || 0) * item.quantity,
    0
  );
  const itemsMissingCost = items.filter((item) => getArticleCifCost(item.article) === null).length;
  const formatUsd = (n: number) =>
    `USD ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.round(n))}`;

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
    th.sortable { cursor: pointer; user-select: none; }
    th.sortable:hover { background: #333333; }
    .sort-icon { opacity: 0.3; font-size: 10px; }
    th.sort-asc .sort-icon, th.sort-desc .sort-icon { opacity: 1; color: #60a5fa; }
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
        <div class="summary-label">Peso Total</div>
        <div class="summary-value">${formatKg(totalWeightKg)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Costo Total (CIF)</div>
        <div class="summary-value">${formatUsd(totalCifCost)}</div>
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
          <th class="sortable" data-col="0" data-type="string">Código <span class="sort-icon">⇅</span></th>
          <th class="sortable" data-col="1" data-type="string">Descripción <span class="sort-icon">⇅</span></th>
          <th class="sortable text-right" data-col="2" data-type="number">Cantidad <span class="sort-icon">⇅</span></th>
          <th class="sortable text-right" data-col="3" data-type="number">Stock Actual <span class="sort-icon">⇅</span></th>
          <th class="sortable text-right" data-col="4" data-type="number">Stock Mín. <span class="sort-icon">⇅</span></th>
          <th>Tendencia (${trendMonths} meses)</th>
          <th>Tend. Activa</th>
          <th class="sortable text-right" data-col="7" data-type="number">Precio Unit. <span class="sort-icon">⇅</span></th>
          <th class="sortable text-right" data-col="8" data-type="number">Prom Ponderado <span class="sort-icon">⇅</span></th>
          <th class="sortable text-right" data-col="9" data-type="number">T. Est. Venta <span class="sort-icon">⇅</span></th>
          <th class="sortable text-right" data-col="10" data-type="number">T. Est. Activa <span class="sort-icon">⇅</span></th>
          <th class="sortable text-center" data-col="11" data-type="string">Clasif. <span class="sort-icon">⇅</span></th>
          <th class="sortable" data-col="12" data-type="date">Última Venta <span class="sort-icon">⇅</span></th>
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
  <script>
    document.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const table = th.closest('table');
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const col = parseInt(th.dataset.col);
        const type = th.dataset.type;
        const isAsc = th.classList.contains('sort-asc');
        const isDesc = th.classList.contains('sort-desc');
        table.querySelectorAll('th').forEach(h => {
          h.classList.remove('sort-asc', 'sort-desc');
          const icon = h.querySelector('.sort-icon');
          if (icon) icon.textContent = '⇅';
        });
        if (isAsc) {
          th.classList.add('sort-desc');
          th.querySelector('.sort-icon').textContent = '↓';
        } else if (isDesc) {
          tbody.append(...rows.sort((a, b) => a.dataset.orig - b.dataset.orig));
          return;
        } else {
          th.classList.add('sort-asc');
          th.querySelector('.sort-icon').textContent = '↑';
        }
        const dir = th.classList.contains('sort-desc') ? -1 : 1;
        rows.sort((a, b) => {
          const aCell = a.cells[col]?.textContent.trim() || '';
          const bCell = b.cells[col]?.textContent.trim() || '';
          if (type === 'number') {
            const aNum = parseFloat(aCell.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
            const bNum = parseFloat(bCell.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
            const aInf = aCell.includes('Infinito') || aCell.includes('∞');
            const bInf = bCell.includes('Infinito') || bCell.includes('∞');
            if (aInf && bInf) return 0;
            if (aInf) return 1;
            if (bInf) return -1;
            return (aNum - bNum) * dir;
          }
          if (type === 'date') {
            const parse = s => { const p = s.split('/'); return p.length === 3 ? new Date(p[2], p[1]-1, p[0]).getTime() : 0; };
            return (parse(aCell) - parse(bCell)) * dir;
          }
          return aCell.localeCompare(bCell) * dir;
        });
        tbody.append(...rows);
      });
    });
    document.querySelectorAll('tbody tr').forEach((r, i) => r.dataset.orig = i);
  </script>
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

  // Container (tonnage) planner — reused in the empty state and the full panel.
  const containerPlanner = (
    <div className="bg-muted/40 mt-2 space-y-2 rounded-lg border p-3 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Container className="h-4 w-4 text-blue-600" />
          Contenedor
          <span className="text-muted-foreground font-normal">
            ({containersNeeded || 1} {containersNeeded === 1 ? 'contenedor' : 'contenedores'})
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Capacidad:</span>
          <Select
            value={containerCapacityKg.toString()}
            onValueChange={(v) => setContainerCapacityKg(parseInt(v))}
          >
            <SelectTrigger className="h-8 w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTAINER_CAPACITIES_KG.map((kg) => (
                <SelectItem key={kg} value={kg.toString()}>
                  {kg / 1000} t
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs">Cubrir:</span>
          <Select
            value={coverageMonths.toString()}
            onValueChange={(v) => setCoverageMonths(parseInt(v))}
          >
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COVERAGE_MONTHS_OPTIONS.map((m) => (
                <SelectItem key={m} value={m.toString()}>
                  {m} meses
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onFillContainer && (
            <Button
              size="sm"
              variant="outline"
              disabled={isFilling || isSaving || remainingInContainerKg <= 0}
              onClick={() =>
                onFillContainer({
                  remainingKg: remainingInContainerKg,
                  capacityKg: containerCapacityKg,
                  coverageMonths,
                  mode: fillMode,
                  excludeNoRotation,
                  maxStockMonths,
                  maxSkus: itemLimit >= ITEM_LIMIT_MAX ? undefined : itemLimit,
                  categoryIds: fillCategoryIds,
                })
              }
              title="Llena el espacio restante del contenedor según el modo elegido"
            >
              {isFilling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {items.length === 0 ? 'Armar contenedor' : 'Completar contenedor'}
            </Button>
          )}
        </div>
      </div>

      {/* Strategy controls */}
      {onFillContainer && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground mr-1 text-xs">Modo:</span>
            {FILL_MODES.map((m) => (
              <Button
                key={m.key}
                size="sm"
                variant={fillMode === m.key ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setFillMode(m.key)}
              >
                {m.label}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant={excludeNoRotation ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setExcludeNoRotation((v) => !v)}
            title="No traer artículos que no se venden"
          >
            {excludeNoRotation ? '✓ ' : ''}Excluir sin rotación
          </Button>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs">Tope stock:</span>
            <Select
              value={maxStockMonths.toString()}
              onValueChange={(v) => setMaxStockMonths(parseInt(v))}
            >
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAX_STOCK_MONTHS_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m.toString()}>
                    {m === 0 ? 'Sin tope' : `${m} meses`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Max items (slider) */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              Ítems:{' '}
              <span className="text-foreground font-medium">
                {itemLimit >= ITEM_LIMIT_MAX ? 'sin límite' : itemLimit}
              </span>
            </span>
            <input
              type="range"
              min={ITEM_LIMIT_MIN}
              max={ITEM_LIMIT_MAX}
              step={ITEM_LIMIT_STEP}
              value={itemLimit}
              onChange={(e) => setItemLimit(parseInt(e.target.value))}
              className="accent-primary h-1 w-28 cursor-pointer"
              title="Máximo de líneas distintas en el pedido"
            />
          </div>

          {/* Category multi-select */}
          {categories.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Layers className="mr-1 h-3 w-3" />
                  {fillCategoryIds.length === 0
                    ? 'Todas las categorías'
                    : `${fillCategoryIds.length} categoría${fillCategoryIds.length !== 1 ? 's' : ''}`}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="max-h-80 w-64 overflow-auto p-2">
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="text-xs font-medium">Categorías</span>
                  {fillCategoryIds.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => setFillCategoryIds([])}
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  {categories.map((cat) => {
                    const checked = fillCategoryIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setFillCategoryIds((prev) =>
                              v ? [...prev, cat.id] : prev.filter((id) => id !== cat.id)
                            )
                          }
                        />
                        {cat.name}
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      <Progress value={currentFillPct} className="h-2.5" />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs">
        <span>
          <span className="font-semibold">{formatKg(currentContainerKg)}</span>
          <span className="text-muted-foreground"> / {formatKg(containerCapacityKg)}</span>
          <span className="text-muted-foreground"> ({currentFillPct.toFixed(0)}%)</span>
        </span>
        <span className="text-muted-foreground">
          Faltan <span className="font-medium">{formatKg(remainingInContainerKg)}</span> para
          completar
        </span>
        {itemsMissingWeight > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            {itemsMissingWeight} artículo{itemsMissingWeight !== 1 ? 's' : ''} sin peso (no computa
            {itemsMissingWeight !== 1 ? 'n' : ''})
          </span>
        )}
      </div>
    </div>
  );

  if (items.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center">
          <ShoppingCart className="mb-3 h-12 w-12 opacity-30" />
          <p className="text-sm">No hay artículos seleccionados para el pedido</p>
          <p className="mt-1 text-xs">
            Seleccioná artículos de la tabla, o armá un contenedor automáticamente por rentabilidad
          </p>
          {onFillContainer && <div className="mt-4 w-full max-w-2xl">{containerPlanner}</div>}
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
                <TableHead className="cursor-pointer" onClick={() => handleSort('Code')}>
                  Código <SortIcon col="Code" />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('Description')}>
                  Descripción <SortIcon col="Description" />
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => handleSort('Quantity')}
                >
                  Cantidad <SortIcon col="Quantity" />
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => handleSort('Weight')}
                >
                  Peso <SortIcon col="Weight" />
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => handleSort('Stock')}
                >
                  Stock Actual <SortIcon col="Stock" />
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => handleSort('MinStock')}
                >
                  Stock Mín. <SortIcon col="MinStock" />
                </TableHead>
                <TableHead>Tendencia ({trendMonths} meses)</TableHead>
                <TableHead>Tend. Activa</TableHead>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead
                        className="cursor-pointer text-right"
                        onClick={() => handleSort('Price')}
                      >
                        Precio Unit. <SortIcon col="Price" />
                      </TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Precio unitario del artículo</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead
                        className="cursor-pointer text-right"
                        onClick={() => handleSort('WMA')}
                      >
                        Prom Ponderado <SortIcon col="WMA" />
                      </TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Promedio ponderado de ventas (WMA) sobre los últimos {trendMonths} meses. Da
                        más peso a los meses recientes.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead
                        className="cursor-pointer text-right"
                        onClick={() => handleSort('EstTime')}
                      >
                        T. Est. Venta <SortIcon col="EstTime" />
                      </TableHead>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Tiempo estimado para vender la cantidad pedida = Cantidad / Prom Ponderado
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TableHead
                        className="cursor-pointer text-right"
                        onClick={() => handleSort('ActiveEstTime')}
                      >
                        T. Est. Activa <SortIcon col="ActiveEstTime" />
                      </TableHead>
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
                        onClick={() => handleSort('Rating')}
                      >
                        Clasif. <SortIcon col="Rating" />
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
                      <TableHead className="cursor-pointer" onClick={() => handleSort('LastSale')}>
                        Última Venta <SortIcon col="LastSale" />
                      </TableHead>
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
                    {Number(item.article.weightKg) > 0 ? (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="font-medium">{formatKg(lineWeightKg(item))}</span>
                        <span className="text-muted-foreground text-[10px]">
                          {Number(item.article.weightKg).toFixed(2)} kg/u
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600" title="Artículo sin peso cargado">
                        s/peso
                      </span>
                    )}
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
              <div className="text-muted-foreground text-xs">Peso Total</div>
              <div className="text-lg font-semibold">{formatKg(totalWeightKg)}</div>
            </div>
            <div>
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                Costo Total (CIF)
                {itemsMissingCost > 0 && (
                  <span title={`${itemsMissingCost} artículo(s) sin costo cargado`}>
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  </span>
                )}
              </div>
              <div className="text-lg font-semibold">{formatUsd(totalCifCost)}</div>
              {totalFobCost > 0 && (
                <div className="text-muted-foreground text-[10px]">
                  FOB {formatUsd(totalFobCost)}
                </div>
              )}
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

        {/* Container (tonnage) planner */}
        {containerPlanner}
      </div>
    </Card>
  );
}
