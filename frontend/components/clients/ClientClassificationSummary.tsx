'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, TrendingDown, UserX, ShoppingCart } from 'lucide-react';
import { ClientStatus } from '@/types/clientClassification';

interface ClassificationSummary {
  active: { count: number; revenue: number };
  slow_moving: { count: number; revenue: number };
  inactive: { count: number; revenue: number };
  never_purchased: { count: number; revenue: number };
}

interface ClientClassificationSummaryProps {
  summary: ClassificationSummary | null;
  selectedStatus: ClientStatus | 'all';
  onStatusClick: (status: ClientStatus | 'all') => void;
  isLoading?: boolean;
}

export default function ClientClassificationSummary({
  summary,
  selectedStatus,
  onStatusClick,
  isLoading = false,
}: ClientClassificationSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-300 rounded w-20"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-300 rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const totalClients = 
    summary.active.count + 
    summary.slow_moving.count + 
    summary.inactive.count + 
    summary.never_purchased.count;

  const totalRevenue = 
    summary.active.revenue + 
    summary.slow_moving.revenue + 
    summary.inactive.revenue;

  const cards = [
    {
      status: 'all' as const,
      label: 'Total Clientes',
      count: totalClients,
      revenue: totalRevenue,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      borderColor: selectedStatus === 'all' ? 'border-blue-600' : 'border-transparent',
    },
    {
      status: ClientStatus.ACTIVE,
      label: 'Activos',
      count: summary.active.count,
      revenue: summary.active.revenue,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
      borderColor: selectedStatus === ClientStatus.ACTIVE ? 'border-green-600' : 'border-transparent',
    },
    {
      status: ClientStatus.SLOW_MOVING,
      label: 'Movimiento Lento',
      count: summary.slow_moving.count,
      revenue: summary.slow_moving.revenue,
      icon: ShoppingCart,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950',
      borderColor: selectedStatus === ClientStatus.SLOW_MOVING ? 'border-yellow-600' : 'border-transparent',
    },
    {
      status: ClientStatus.INACTIVE,
      label: 'Inactivos',
      count: summary.inactive.count,
      revenue: summary.inactive.revenue,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950',
      borderColor: selectedStatus === ClientStatus.INACTIVE ? 'border-red-600' : 'border-transparent',
    },
    {
      status: ClientStatus.NEVER_PURCHASED,
      label: 'Sin Compras',
      count: summary.never_purchased.count,
      revenue: summary.never_purchased.revenue,
      icon: UserX,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 dark:bg-gray-950',
      borderColor: selectedStatus === ClientStatus.NEVER_PURCHASED ? 'border-gray-600' : 'border-transparent',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const percentage = totalClients > 0 ? (card.count / totalClients) * 100 : 0;

        return (
          <Card
            key={card.status}
            className={`cursor-pointer transition-all hover:shadow-lg border-2 ${card.borderColor} ${card.bgColor}`}
            onClick={() => onStatusClick(card.status)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{card.count}</span>
                  <Badge variant="secondary" className="text-xs">
                    {percentage.toFixed(0)}%
                  </Badge>
                </div>
                {card.revenue > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(card.revenue)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

