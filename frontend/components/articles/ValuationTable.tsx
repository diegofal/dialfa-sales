'use client';

import { TrendingDown, TrendingUp, Minus, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { SparklineWithTooltip } from '@/components/ui/sparkline';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ROUTES } from '@/lib/constants/routes';
import {
  calculateMarginPercent,
  formatMarginPercent,
  getMarginColorClass,
} from '@/lib/utils/articles/marginCalculations';
import { StockStatus, StockValuationMetrics } from '@/types/stockValuation';
import { StockStatusBadge } from './StockStatusBadge';

interface ValuationTableProps {
  articles: StockValuationMetrics[];
  trendMonths?: number;
}

const trendConfig = {
  increasing: { icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
  stable: { icon: Minus, color: 'text-blue-600 dark:text-blue-400' },
  decreasing: { icon: TrendingDown, color: 'text-red-600 dark:text-red-400' },
  none: { icon: Minus, color: 'text-gray-600 dark:text-gray-400' },
};

const STATUS_ORDER: Record<StockStatus, number> = {
  [StockStatus.ACTIVE]: 1,
  [StockStatus.SLOW_MOVING]: 2,
  [StockStatus.DEAD_STOCK]: 3,
  [StockStatus.NEVER_SOLD]: 4,
};

function getMargin(article: StockValuationMetrics): number | null {
  return calculateMarginPercent(article.unitPrice, article.unitCost);
}

/** Largest payment-term discount available for the article. Defaults to 0 if none. */
function getMaxPaymentDiscount(article: StockValuationMetrics): number {
  return article.paymentTermsValuation.reduce(
    (max, p) => (p.discountPercent > max ? p.discountPercent : max),
    0
  );
}

/** Sell price with the largest payment-term discount applied. */
function getDiscountedSellPrice(article: StockValuationMetrics): number {
  const maxDiscount = getMaxPaymentDiscount(article);
  return article.unitPrice * (1 - maxDiscount / 100);
}

/** Returns the comparable value for a given sort key, or null when missing. */
function getSortValue(article: StockValuationMetrics, key: string): number | string | null {
  switch (key) {
    case 'code':
      return article.articleCode;
    case 'description':
      return article.articleDescription;
    case 'category':
      return article.categoryName;
    case 'status':
      return STATUS_ORDER[article.status] ?? 99;
    case 'stock':
      return article.currentStock;
    case 'lastSale':
      return article.daysSinceLastSale ?? null;
    case 'trend':
      return article.avgMonthlySales;
    case 'fob':
      return article.unitCostFob > 0 ? article.unitCostFob : null;
    case 'lastProforma':
      return article.lastPurchaseProformaDate ?? article.lastPurchaseProformaNumber ?? null;
    case 'cifCost':
      return article.unitCost > 0 ? article.unitCost : null;
    case 'stockValue':
      return article.stockValue;
    case 'listPrice':
      return article.stockValueAtListPrice;
    case 'discountedSell':
      return getDiscountedSellPrice(article);
    case 'margin':
      return getMargin(article);
    default:
      return null;
  }
}

function compareValues(
  a: number | string | null,
  b: number | string | null,
  descending: boolean
): number {
  // Nulls always go to the bottom regardless of direction.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const dir = descending ? -1 : 1;
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b, 'es') * dir;
  }
  return ((a as number) - (b as number)) * dir;
}

export function ValuationTable({ articles }: ValuationTableProps) {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDescending, setSortDescending] = useState(false);

  const handleSort = (key: string, descending: boolean) => {
    setSortBy(key);
    setSortDescending(descending);
  };

  const sortedArticles = useMemo(() => {
    if (!sortBy) return articles;
    return [...articles].sort((a, b) =>
      compareValues(getSortValue(a, sortBy), getSortValue(b, sortBy), sortDescending)
    );
  }, [articles, sortBy, sortDescending]);

  const formatCurrency = (value: number) => {
    if (isNaN(value) || value === null || value === undefined) {
      return '-';
    }
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
  };

  const getSparklineColor = (direction: string) => {
    switch (direction) {
      case 'increasing':
        return 'rgb(34, 197, 94)';
      case 'decreasing':
        return 'rgb(239, 68, 68)';
      default:
        return 'rgb(59, 130, 246)';
    }
  };

  const handleViewDetails = (code: string) => {
    router.push(`${ROUTES.ARTICLES}?search=${code}`);
  };

  const sortProps = {
    currentSortBy: sortBy,
    currentSortDescending: sortDescending,
    onSort: handleSort,
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead sortKey="code" {...sortProps} className="w-[120px]">
              Código
            </SortableTableHead>
            <SortableTableHead sortKey="description" {...sortProps}>
              Descripción
            </SortableTableHead>
            <SortableTableHead sortKey="category" {...sortProps} className="w-[120px]">
              Categoría
            </SortableTableHead>
            <SortableTableHead sortKey="status" {...sortProps} className="w-[130px]">
              Estado
            </SortableTableHead>
            <SortableTableHead sortKey="stock" {...sortProps} align="right" className="w-[80px]">
              Stock
            </SortableTableHead>
            <SortableTableHead sortKey="lastSale" {...sortProps} className="w-[110px]">
              Última Venta
            </SortableTableHead>
            <SortableTableHead sortKey="trend" {...sortProps} className="w-[140px]">
              Tendencia
            </SortableTableHead>
            <SortableTableHead sortKey="fob" {...sortProps} align="right" className="w-[90px]">
              FOB
            </SortableTableHead>
            <SortableTableHead sortKey="lastProforma" {...sortProps} className="w-[140px]">
              Última Proforma
            </SortableTableHead>
            <SortableTableHead sortKey="cifCost" {...sortProps} align="right" className="w-[100px]">
              Costo CIF
            </SortableTableHead>
            <SortableTableHead
              sortKey="stockValue"
              {...sortProps}
              align="right"
              className="w-[110px]"
            >
              Valor Costo
            </SortableTableHead>
            <SortableTableHead
              sortKey="listPrice"
              {...sortProps}
              align="right"
              className="w-[110px]"
            >
              Precio Lista
            </SortableTableHead>
            <SortableTableHead
              sortKey="discountedSell"
              {...sortProps}
              align="right"
              className="w-[120px]"
            >
              Venta c/desc
            </SortableTableHead>
            <SortableTableHead sortKey="margin" {...sortProps} align="right" className="w-[90px]">
              Margen
            </SortableTableHead>
            <SortableTableHead className="w-[80px]">{''}</SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedArticles.map((article) => {
            const TrendIcon = trendConfig[article.salesTrendDirection].icon;
            const margin = getMargin(article);

            return (
              <TableRow key={article.articleId}>
                <TableCell className="font-medium">{article.articleCode}</TableCell>
                <TableCell className="max-w-[300px] truncate">
                  {article.articleDescription}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {article.categoryName}
                </TableCell>
                <TableCell>
                  <StockStatusBadge status={article.status} />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {article.currentStock.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {article.daysSinceLastSale !== null ? (
                      <>
                        <div className="font-semibold">Hace {article.daysSinceLastSale}d</div>
                        <div className="text-muted-foreground text-xs">
                          {formatDate(article.lastSaleDate)}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Nunca</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {article.salesTrend.length > 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs">
                        <TrendIcon
                          className={`h-3 w-3 ${trendConfig[article.salesTrendDirection].color}`}
                        />
                        <span className="text-muted-foreground">
                          {article.avgMonthlySales.toFixed(1)}/mes
                        </span>
                      </div>
                      <SparklineWithTooltip
                        data={article.salesTrend}
                        labels={Array.from({ length: article.salesTrend.length }, (_, i) => {
                          const date = new Date();
                          date.setMonth(date.getMonth() - (article.salesTrend.length - 1 - i));
                          return date.toLocaleDateString('es-AR', {
                            month: 'short',
                            year: '2-digit',
                          });
                        })}
                        width={100}
                        height={20}
                        color={getSparklineColor(article.salesTrendDirection)}
                        fillColor={`${getSparklineColor(article.salesTrendDirection)}20`}
                        formatValue={(v) => `${v} unidades`}
                      />
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">Sin datos</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">
                  {article.unitCostFob > 0 ? formatCurrency(article.unitCostFob) : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {article.lastPurchaseProformaNumber ? (
                    <div className="flex flex-col">
                      <span>{article.lastPurchaseProformaNumber}</span>
                      {article.lastPurchaseProformaDate && (
                        <span className="text-[10px]">{article.lastPurchaseProformaDate}</span>
                      )}
                    </div>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">
                  {formatCurrency(article.unitCost)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency(article.stockValue)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency(article.stockValueAtListPrice)}
                </TableCell>
                <TableCell
                  className={`text-right text-sm font-medium ${getMarginColorClass(margin)}`}
                >
                  {(() => {
                    const maxDisc = getMaxPaymentDiscount(article);
                    if (maxDisc <= 0) {
                      return <span className="text-muted-foreground">—</span>;
                    }
                    const stockSold = article.currentStock * getDiscountedSellPrice(article);
                    return formatCurrency(stockSold);
                  })()}
                </TableCell>
                <TableCell
                  className={`text-right text-sm font-medium ${getMarginColorClass(margin)}`}
                >
                  {formatMarginPercent(margin)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDetails(article.articleCode)}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
