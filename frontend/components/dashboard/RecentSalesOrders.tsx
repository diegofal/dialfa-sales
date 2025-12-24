'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShoppingCart, TrendingUp, Clock } from 'lucide-react';
import Link from 'next/link';
import type { SalesOrder } from '@/types/salesOrder';

interface RecentSalesOrdersProps {
  limit?: number;
}

export function RecentSalesOrders({ limit = 5 }: RecentSalesOrdersProps) {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecentOrders() {
      try {
        setLoading(true);
        const response = await fetch(`/api/sales-orders?limit=${limit}&page=1`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch recent orders');
        }

        const data = await response.json();
        setOrders(data.data || []);
      } catch (err) {
        console.error('Error fetching recent orders:', err);
        setError('No se pudieron cargar los pedidos recientes');
      } finally {
        setLoading(false);
      }
    }

    fetchRecentOrders();
  }, [limit]);

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
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
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
          <CardDescription>
            Los {limit} pedidos creados más recientemente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          <CardDescription>
            Los {limit} pedidos creados más recientemente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>{error}</p>
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
          <CardDescription>
            Los {limit} pedidos creados más recientemente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
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
            <CardDescription>
              Los {limit} pedidos creados más recientemente
            </CardDescription>
          </div>
          <Link 
            href="/dashboard/sales-orders"
            className="text-sm text-primary hover:underline flex items-center gap-1"
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
              href={`/dashboard/sales-orders/${order.id}`}
              className="block p-4 rounded-lg border bg-card hover:bg-accent hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground">
                      {order.orderNumber}
                    </p>
                    {getStatusBadge(order.status)}
                  </div>
                  
                  <p className="text-sm text-muted-foreground truncate mb-1">
                    {order.clientBusinessName}
                  </p>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-foreground">
                    {formatCurrency(order.total)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

