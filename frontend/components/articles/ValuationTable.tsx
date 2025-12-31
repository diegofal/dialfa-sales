import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StockStatus, StockValuationMetrics } from '@/types/stockValuation';
import { Sparkline, SparklineWithTooltip } from '@/components/ui/sparkline';
import { TrendingDown, TrendingUp, Minus, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ValuationTableProps {
  articles: StockValuationMetrics[];
  trendMonths?: number;
}

const statusConfig = {
  [StockStatus.ACTIVE]: {
    label: 'Activo',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  [StockStatus.SLOW_MOVING]: {
    label: 'Mov. Lento',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  },
  [StockStatus.DEAD_STOCK]: {
    label: 'Stock Muerto',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
  [StockStatus.NEVER_SOLD]: {
    label: 'Nunca Vendido',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  },
};

const trendConfig = {
  increasing: { icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
  stable: { icon: Minus, color: 'text-blue-600 dark:text-blue-400' },
  decreasing: { icon: TrendingDown, color: 'text-red-600 dark:text-red-400' },
  none: { icon: Minus, color: 'text-gray-600 dark:text-gray-400' },
};

export function ValuationTable({ articles, trendMonths = 6 }: ValuationTableProps) {
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
    router.push(`/dashboard/articles?search=${code}`);
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="w-[130px]">Estado</TableHead>
            <TableHead className="text-right w-[80px]">Stock</TableHead>
            <TableHead className="w-[110px]">Última Venta</TableHead>
            <TableHead className="w-[140px]">Tendencia</TableHead>
            <TableHead className="text-right w-[100px]">Costo</TableHead>
            <TableHead className="text-right w-[110px]">Valor Costo</TableHead>
            <TableHead className="text-right w-[110px]">Precio Lista</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.map((article) => {
            const statusConf = statusConfig[article.status];
            const TrendIcon = trendConfig[article.salesTrendDirection].icon;

            return (
              <TableRow key={article.articleId}>
                <TableCell className="font-medium">{article.articleCode}</TableCell>
                <TableCell className="max-w-[300px] truncate">
                  {article.articleDescription}
                </TableCell>
                <TableCell>
                  <Badge className={`${statusConf.color} text-xs`}>
                    {statusConf.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {article.currentStock.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {article.daysSinceLastSale !== null ? (
                      <>
                        <div className="font-semibold">
                          Hace {article.daysSinceLastSale}d
                        </div>
                        <div className="text-xs text-muted-foreground">
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
                          className={`h-3 w-3 ${
                            trendConfig[article.salesTrendDirection].color
                          }`}
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
                          return date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
                        })}
                        width={100}
                        height={20}
                        color={getSparklineColor(article.salesTrendDirection)}
                        fillColor={`${getSparklineColor(
                          article.salesTrendDirection
                        )}20`}
                        formatValue={(v) => `${v} unidades`}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin datos</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatCurrency(article.unitCost)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency(article.stockValue)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency(article.stockValueAtListPrice)}
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

