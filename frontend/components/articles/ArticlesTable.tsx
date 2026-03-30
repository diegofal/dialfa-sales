'use client';

import { Pencil, Trash2, Package } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ClickableTableRow } from '@/components/ui/clickable-table-row';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { SparklineWithTooltip } from '@/components/ui/sparkline';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ACTION_BUTTON_CONFIG } from '@/lib/constants/tableActions';
import {
  calculateWeightedAvgSales,
  calculateEstimatedSaleTime,
  formatSaleTime,
} from '@/lib/utils/salesCalculations';
import { useAuthStore } from '@/store/authStore';
import { Article } from '@/types/article';
import StockAdjustDialog from './StockAdjustDialog';

type ActiveRating = 'GREAT' | 'GOOD' | 'OK' | 'SLOW' | 'NO DATA';

const RATING_CONFIG: Record<
  ActiveRating,
  { label: string; color: string; bg: string; border: string }
> = {
  GREAT: {
    label: 'Excelente',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  GOOD: {
    label: 'Bueno',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  OK: {
    label: 'Regular',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  SLOW: {
    label: 'Lento',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  'NO DATA': {
    label: 'Sin datos',
    color: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
  },
};

function getArticleActiveRating(article: Article): ActiveRating {
  const trend = article.activeStockTrend;
  if (!trend || trend.length === 0) return 'NO DATA';
  const wma = calculateWeightedAvgSales(trend, trend.length);
  if (wma <= 0) return 'NO DATA';
  const est = calculateEstimatedSaleTime(article.stock, wma);
  if (!isFinite(est)) return 'NO DATA';
  if (est <= 12) return 'GREAT';
  if (est <= 24) return 'GOOD';
  if (est <= 60) return 'OK';
  return 'SLOW';
}

interface ArticlesTableProps {
  articles: Article[];
  onEdit: (article: Article) => void;
  onDelete: (id: number) => void;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
  trendMonths?: number;
  // Supplier order mode
  selectionMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (article: Article) => void;
}

export function ArticlesTable({
  articles,
  onEdit,
  onDelete,
  currentSortBy,
  currentSortDescending,
  onSort,
  trendMonths = 12,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}: ArticlesTableProps) {
  const [adjustingArticle, setAdjustingArticle] = useState<Article | null>(null);
  const { isAdmin } = useAuthStore();

  const canEdit = isAdmin();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectionMode && (
              <SortableTableHead className="w-12">
                <span className="sr-only">Seleccionar</span>
              </SortableTableHead>
            )}
            <SortableTableHead
              sortKey="Code"
              currentSortBy={currentSortBy}
              currentSortDescending={currentSortDescending}
              onSort={onSort}
            >
              Código
            </SortableTableHead>
            <SortableTableHead
              sortKey="Description"
              currentSortBy={currentSortBy}
              currentSortDescending={currentSortDescending}
              onSort={onSort}
            >
              Descripción
            </SortableTableHead>
            <SortableTableHead>Categoría</SortableTableHead>
            <SortableTableHead
              sortKey="Stock"
              currentSortBy={currentSortBy}
              currentSortDescending={currentSortDescending}
              onSort={onSort}
              align="right"
            >
              Stock Actual
            </SortableTableHead>
            <SortableTableHead
              sortKey="MinimumStock"
              currentSortBy={currentSortBy}
              currentSortDescending={currentSortDescending}
              onSort={onSort}
              align="right"
            >
              Stock Mín.
            </SortableTableHead>
            <SortableTableHead>Tendencia ({trendMonths} meses)</SortableTableHead>
            <SortableTableHead>Tend. Activa</SortableTableHead>
            <SortableTableHead
              sortKey="UnitPrice"
              currentSortBy={currentSortBy}
              currentSortDescending={currentSortDescending}
              onSort={onSort}
              align="right"
            >
              Precio Unit.
            </SortableTableHead>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SortableTableHead align="right" className="cursor-help">
                    Prom Ponderado
                  </SortableTableHead>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Promedio ponderado de ventas (WMA) sobre los últimos {trendMonths} meses. Da más
                    peso a los meses recientes.
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SortableTableHead align="right" className="cursor-help">
                    T. Est. Venta
                  </SortableTableHead>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Tiempo estimado para vender el stock actual = Stock / Prom Ponderado
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SortableTableHead align="right" className="cursor-help">
                    T. Est. Activa
                  </SortableTableHead>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Tiempo estimado usando el mejor período histórico de actividad
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SortableTableHead className="cursor-help text-center">Clasif.</SortableTableHead>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Clasificación basada en T. Est. Activa: Excelente (≤1a), Bueno (1-2a), Regular
                    (2-5a), Lento (&gt;5a)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <SortableTableHead>Última Venta</SortableTableHead>
            <SortableTableHead align="right">Acciones</SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={selectionMode ? 15 : 14}
                className="text-muted-foreground text-center"
              >
                No hay artículos para mostrar
              </TableCell>
            </TableRow>
          ) : (
            articles.map((article) => {
              const wma = calculateWeightedAvgSales(article.salesTrend, trendMonths);
              const estTime = calculateEstimatedSaleTime(article.stock, wma);
              const activeWma = article.activeStockTrend?.length
                ? calculateWeightedAvgSales(
                    article.activeStockTrend,
                    article.activeStockTrend.length
                  )
                : 0;
              const activeEstTime =
                activeWma > 0 ? calculateEstimatedSaleTime(article.stock, activeWma) : Infinity;
              const rating = getArticleActiveRating(article);
              const ratingCfg = RATING_CONFIG[rating];

              return (
                <ClickableTableRow
                  key={article.id}
                  onRowClick={() => {
                    if (selectionMode && onToggleSelect) {
                      onToggleSelect(article);
                    } else if (canEdit) {
                      onEdit(article);
                    }
                  }}
                  aria-label={`${canEdit ? 'Editar' : 'Ver'} artículo ${article.code} - ${article.description}`}
                  className={`${!canEdit && !selectionMode ? 'cursor-default' : ''} ${
                    selectionMode && selectedIds.has(article.id) ? 'bg-primary/10' : ''
                  }`}
                >
                  {selectionMode && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(article.id)}
                        onCheckedChange={() => onToggleSelect && onToggleSelect(article)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{article.code}</TableCell>
                  <TableCell>
                    <div className="max-w-md">
                      <p className="truncate">{article.description}</p>
                      {article.location && (
                        <p className="text-muted-foreground text-xs">📍 {article.location}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{article.categoryName}</TableCell>
                  <TableCell className="text-right">
                    <span className={article.isLowStock ? 'text-destructive font-semibold' : ''}>
                      {article.stock}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {article.minimumStock}
                  </TableCell>

                  {/* Tendencia */}
                  <TableCell>
                    {article.salesTrend && article.salesTrend.length > 0 ? (
                      <div className="flex flex-col">
                        <SparklineWithTooltip
                          data={article.salesTrend}
                          labels={article.salesTrendLabels}
                          width={Math.min(180, Math.max(80, article.salesTrend.length * 10))}
                          height={40}
                          color={
                            article.abcClass === 'A'
                              ? 'rgb(34, 197, 94)'
                              : article.abcClass === 'B'
                                ? 'rgb(59, 130, 246)'
                                : 'rgb(107, 114, 128)'
                          }
                          fillColor={
                            article.abcClass === 'A'
                              ? 'rgba(34, 197, 94, 0.1)'
                              : article.abcClass === 'B'
                                ? 'rgba(59, 130, 246, 0.1)'
                                : 'rgba(107, 114, 128, 0.1)'
                          }
                          formatValue={(v) => `${v} unidades`}
                        />
                        {article.salesTrendLabels && article.salesTrendLabels.length > 0 && (
                          <span className="text-muted-foreground text-[10px]">
                            {article.salesTrendLabels[0]} -{' '}
                            {article.salesTrendLabels[article.salesTrendLabels.length - 1]}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Sin datos</span>
                    )}
                  </TableCell>

                  {/* Tendencia Activa */}
                  <TableCell>
                    {article.activeStockTrend && article.activeStockTrend.length > 0 ? (
                      <div className="flex flex-col">
                        <SparklineWithTooltip
                          data={article.activeStockTrend}
                          labels={article.activeStockTrendLabels}
                          width={Math.min(180, Math.max(80, article.activeStockTrend.length * 15))}
                          height={40}
                          color="rgb(245, 158, 11)"
                          fillColor="rgba(245, 158, 11, 0.1)"
                          formatValue={(v) => `${v} unidades`}
                        />
                        <span className="text-muted-foreground text-[10px]">
                          {article.activeStockTrendLabels?.[0]} -{' '}
                          {
                            article.activeStockTrendLabels?.[
                              article.activeStockTrendLabels.length - 1
                            ]
                          }{' '}
                          ({article.activeStockMonths}m)
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">= completa</span>
                    )}
                  </TableCell>

                  {/* Precio Unit. */}
                  <TableCell className="text-right font-medium">
                    {formatPrice(article.unitPrice)}
                  </TableCell>

                  {/* Prom Ponderado (WMA) */}
                  <TableCell className="text-right">
                    {wma > 0 ? (
                      <Badge variant="outline" className="text-xs">
                        {wma.toFixed(1)}
                      </Badge>
                    ) : article.salesTrend && article.salesTrend.length > 0 ? (
                      <span className="text-muted-foreground text-xs">0.0</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>

                  {/* T. Est. Venta */}
                  <TableCell className="text-right">
                    <Badge
                      variant={isFinite(estTime) && estTime > 0 ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {formatSaleTime(estTime)}
                    </Badge>
                  </TableCell>

                  {/* T. Est. Activa */}
                  <TableCell className="text-right">
                    {article.activeStockTrend && article.activeStockTrend.length > 0 ? (
                      <Badge
                        variant={
                          isFinite(activeEstTime) && activeEstTime > 0 ? 'secondary' : 'outline'
                        }
                        className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400"
                      >
                        {formatSaleTime(activeEstTime)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>

                  {/* Clasificación */}
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`text-xs ${ratingCfg.color} ${ratingCfg.bg} ${ratingCfg.border}`}
                    >
                      {ratingCfg.label}
                    </Badge>
                  </TableCell>

                  {/* Última Venta */}
                  <TableCell>
                    {article.lastSaleDate ? (
                      <span className="text-sm">
                        {new Date(article.lastSaleDate).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Nunca vendido</span>
                    )}
                  </TableCell>

                  {/* Acciones */}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!selectionMode && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdjustingArticle(article);
                            }}
                            title="Ajustar Stock"
                          >
                            <Package className="h-4 w-4" />
                          </Button>

                          {canEdit && (
                            <Button
                              variant={ACTION_BUTTON_CONFIG.edit.variant}
                              size={ACTION_BUTTON_CONFIG.edit.size}
                              onClick={() => onEdit(article)}
                              title={ACTION_BUTTON_CONFIG.edit.title}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}

                          {canEdit && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant={ACTION_BUTTON_CONFIG.delete.variant}
                                  size={ACTION_BUTTON_CONFIG.delete.size}
                                  title={ACTION_BUTTON_CONFIG.delete.title}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción eliminará el artículo &quot;{article.description}
                                    &quot;. Los datos permanecerán en el sistema pero no se
                                    mostrarán.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDelete(article.id)}>
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </ClickableTableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {adjustingArticle && (
        <StockAdjustDialog
          isOpen={!!adjustingArticle}
          onClose={() => setAdjustingArticle(null)}
          articleId={adjustingArticle.id}
          articleCode={adjustingArticle.code}
          articleDescription={adjustingArticle.description}
          currentStock={adjustingArticle.stock}
        />
      )}
    </div>
  );
}
