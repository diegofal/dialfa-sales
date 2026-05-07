'use client';

import { Calendar, DollarSign, Percent, Warehouse } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import {
  formatMarginPercent,
  getArticleCifCost,
  getArticleMarginPercent,
} from '@/lib/utils/articles/marginCalculations';
import { Article } from '@/types/article';

interface ArticleHeroStatsProps {
  article: Article;
}

const formatNumber = (n: number): string => new Intl.NumberFormat('es-AR').format(n);

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
};

const daysSince = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
};

export function ArticleHeroStats({ article }: ArticleHeroStatsProps) {
  const cifCost = getArticleCifCost({
    lastPurchasePrice: article.lastPurchasePrice ?? null,
    cifPercentage: article.cifPercentage ?? null,
  });

  const marginPct = getArticleMarginPercent({
    unitPrice: article.unitPrice,
    lastPurchasePrice: article.lastPurchasePrice ?? null,
    cifPercentage: article.cifPercentage ?? null,
    categoryDefaultDiscount: article.categoryDefaultDiscount,
    categoryMaxPaymentDiscount: article.categoryMaxPaymentDiscount,
  });

  const lastSaleDays = daysSince(article.lastSaleDate);
  const lastSaleSubtitle =
    article.lastSaleDate === null || article.lastSaleDate === undefined
      ? 'Sin ventas registradas'
      : lastSaleDays !== null
        ? `Hace ${lastSaleDays} días`
        : '—';

  const avgMonthly = article.avgMonthlySales ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Stock Actual"
        value={formatNumber(article.stock)}
        subtitle={`Mínimo: ${formatNumber(article.minimumStock)}${article.location ? ` · ${article.location}` : ''}`}
        icon={Warehouse}
        gradient={
          article.isLowStock
            ? 'bg-gradient-to-br from-red-500 to-red-700'
            : article.stock <= 0
              ? 'bg-gradient-to-br from-zinc-600 to-zinc-800'
              : 'bg-gradient-to-br from-blue-500 to-blue-700'
        }
      />

      <MetricCard
        title="Última Venta"
        value={formatDate(article.lastSaleDate)}
        subtitle={lastSaleSubtitle}
        icon={Calendar}
        gradient="bg-gradient-to-br from-teal-500 to-teal-700"
      />

      <MetricCard
        title="Costo CIF"
        value={cifCost !== null ? `US$ ${cifCost.toFixed(2)}` : '—'}
        subtitle={
          article.lastPurchasePrice
            ? `FOB US$ ${article.lastPurchasePrice.toFixed(2)} · CIF ${article.cifPercentage ?? 50}%`
            : 'Sin compras registradas'
        }
        icon={DollarSign}
        gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
      />

      <MetricCard
        title="Margen"
        value={formatMarginPercent(marginPct)}
        subtitle={`Rotación: ${avgMonthly.toFixed(1)} u/mes`}
        icon={Percent}
        gradient="bg-gradient-to-br from-violet-500 to-violet-700"
      />
    </div>
  );
}
