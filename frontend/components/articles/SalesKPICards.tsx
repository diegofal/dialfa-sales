'use client';

import { DollarSign, Package, Receipt, ShoppingCart, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SalesKPIs } from '@/types/salesAnalytics';

interface SalesKPICardsProps {
  kpis: SalesKPIs;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  }).format(value);
};

export function SalesKPICards({ kpis }: SalesKPICardsProps) {
  const cards = [
    {
      label: 'Ingresos Totales',
      value: formatCurrency(kpis.totalRevenue),
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      label: 'Unidades Vendidas',
      value: formatNumber(kpis.totalUnits),
      icon: Package,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'Ticket Promedio',
      value: formatCurrency(kpis.avgOrderValue),
      icon: ShoppingCart,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    },
    {
      label: 'Artículos Únicos',
      value: formatNumber(kpis.uniqueArticlesSold),
      icon: BarChart3,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    },
    {
      label: 'Facturas Emitidas',
      value: formatNumber(kpis.invoiceCount),
      icon: Receipt,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-950/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground truncate text-xs font-medium">{card.label}</p>
                <p className="truncate text-lg font-bold">{card.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
