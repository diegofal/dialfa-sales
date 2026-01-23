'use client';

import { Loader2, ShoppingCart, TrendingUp, Clock } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/lib/constants/routes';
import { useSalesOrders } from '@/lib/hooks/useSalesOrders';

interface RecentSalesOrdersProps {
  limit?: number;
}

export function RecentSalesOrders({ limit = 5 }: RecentSalesOrdersProps) {
  const { data, isLoading: loading, error } = useSalesOrders({ pageSize: limit, pageNumber: 1 });
  const orders = data?.data ?? [];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { label: 'Pendiente', variant: 'secondary' as const },
      INVOICED: { label: 'Facturado', variant: 'default' as const },
      COMPLETED: { label: 'Completado', variant: 'default' as const },
      CANCELLED: { label: 'Cancelado', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      variant: 'secondary' as const,
    };

    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const months = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Últimos Pedidos
          </CardTitle>
          <CardDescription>Los {limit} pedidos creados más recientemente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Últimos Pedidos
          </CardTitle>
          <CardDescription>Los {limit} pedidos creados más recientemente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            <p>No se pudieron cargar los pedidos recientes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Últimos Pedidos
          </CardTitle>
          <CardDescription>Los {limit} pedidos creados más recientemente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            <p>No hay pedidos disponibles</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Últimos Pedidos
            </CardTitle>
            <CardDescription>Los {limit} pedidos creados más recientemente</CardDescription>
          </div>
          <Link
            href={ROUTES.SALES_ORDERS}
            className="text-primary flex items-center gap-1 text-sm hover:underline"
          >
            Ver todos
            <TrendingUp className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`${ROUTES.SALES_ORDERS}/${order.id}`}
              className="bg-card hover:bg-accent block rounded-lg border p-4 transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-foreground text-sm font-semibold">{order.orderNumber}</p>
                    {getStatusBadge(order.status)}
                  </div>

                  <p className="text-muted-foreground mb-1 truncate text-sm">
                    {order.clientBusinessName}
                  </p>

                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(order.orderDate)}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-foreground text-sm font-bold">{formatCurrency(order.total)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
