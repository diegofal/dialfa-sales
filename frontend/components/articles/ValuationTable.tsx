import { TrendingDown, TrendingUp, Minus, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SparklineWithTooltip } from '@/components/ui/sparkline';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/lib/constants/routes';
import {
  calculateMarginPercent,
  formatMarginPercent,
  getMarginColorClass,
} from '@/lib/utils/articles/marginCalculations';
import { StockValuationMetrics } from '@/types/stockValuation';
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

export function ValuationTable({ articles }: ValuationTableProps) {
  const router = useRouter();

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

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="w-[120px]">Categoría</TableHead>
            <TableHead className="w-[130px]">Estado</TableHead>
            <TableHead className="w-[80px] text-right">Stock</TableHead>
            <TableHead className="w-[110px]">Última Venta</TableHead>
            <TableHead className="w-[140px]">Tendencia</TableHead>
            <TableHead className="w-[90px] text-right">FOB</TableHead>
            <TableHead className="w-[100px] text-right">Costo CIF</TableHead>
            <TableHead className="w-[110px] text-right">Valor Costo</TableHead>
            <TableHead className="w-[110px] text-right">Precio Lista</TableHead>
            <TableHead className="w-[90px] text-right">Margen</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.map((article) => {
            const TrendIcon = trendConfig[article.salesTrendDirection].icon;
            const margin = calculateMarginPercent(article.unitPrice, article.unitCost);

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
