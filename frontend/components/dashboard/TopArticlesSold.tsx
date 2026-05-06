/**
 * Top Articles Sold (current month).
 * Powered by SalesAnalyticsService.getSalesAnalytics({ periodMonths: 1 }) and
 * enriched via calculateStockValuation() for current stock + status badge.
 *
 * Reuses StockStatusBadge so the status label matches the article detail page.
 */

'use client';

import { Package, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { StockStatusBadge } from '@/components/articles/StockStatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/lib/constants/routes';
import { useTopArticlesSold } from '@/lib/hooks/domain/useDashboard';
import { StockStatus } from '@/types/stockValuation';

const formatUsd = (value: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatUnits = (value: number): string => new Intl.NumberFormat('es-AR').format(value);

export function TopArticlesSold() {
  const { data, isLoading, isError } = useTopArticlesSold();

  const articles = data?.articles ?? [];
  const dataError = data?.error ?? (isError ? 'Error al cargar' : null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Top 10 Artículos Vendidos del Mes
            </CardTitle>
            <CardDescription>Por revenue, con stock actual y estado</CardDescription>
          </div>
          <Link
            href={ROUTES.ARTICLES}
            className="text-primary flex items-center gap-1 text-sm hover:underline"
          >
            Ver artículos
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-muted/40 h-10 w-full animate-pulse rounded-md" />
            ))}
          </div>
        ) : dataError ? (
          <div className="flex flex-col items-center gap-1 py-8 text-center text-sm">
            <span className="font-medium text-amber-500">No se pudo cargar</span>
            <span className="text-muted-foreground text-xs">{dataError}</span>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
            <Package className="h-8 w-8 opacity-40" />
            <span className="text-sm">Sin facturas en el mes</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card text-muted-foreground sticky top-0 text-xs uppercase">
                <tr className="border-b">
                  <th className="pb-2 text-left">#</th>
                  <th className="pb-2 text-left">Código</th>
                  <th className="pb-2 text-left">Descripción</th>
                  <th className="pb-2 text-right">Vendido</th>
                  <th className="pb-2 text-right">Revenue</th>
                  <th className="pb-2 text-right">Stock</th>
                  <th className="pb-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a, i) => {
                  const stockClass =
                    a.currentStock <= 0
                      ? 'text-red-500 font-medium'
                      : a.currentStock < a.unitsSold
                        ? 'text-amber-500 font-medium'
                        : 'text-foreground';
                  return (
                    <tr key={a.articleId} className="border-border/30 hover:bg-accent/40 border-b">
                      <td className="text-muted-foreground py-2 text-xs">{i + 1}</td>
                      <td className="py-2 font-mono text-xs">{a.code}</td>
                      <td className="max-w-[280px] truncate py-2">{a.description}</td>
                      <td className="py-2 text-right tabular-nums">{formatUnits(a.unitsSold)}</td>
                      <td className="py-2 text-right tabular-nums">{formatUsd(a.revenueUsd)}</td>
                      <td className={`py-2 text-right tabular-nums ${stockClass}`}>
                        {formatUnits(a.currentStock)}
                      </td>
                      <td className="py-2">
                        <StockStatusBadge status={a.status as StockStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
