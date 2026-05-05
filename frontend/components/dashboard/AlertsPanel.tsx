/**
 * Alerts Panel (Fila 4 derecha)
 * Compact list of operational alerts: stockouts, late proformas, stale quotes.
 */

'use client';

import { Bell, FileWarning, PackageX, Timer } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/lib/constants/routes';
import { useDashboardAlerts } from '@/lib/hooks/domain/useDashboard';

interface AlertItem {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  href: string;
  severity: 'high' | 'medium' | 'low';
}

const severityRing: Record<AlertItem['severity'], string> = {
  high: 'bg-red-500/10 text-red-500 ring-red-500/30',
  medium: 'bg-amber-500/10 text-amber-500 ring-amber-500/30',
  low: 'bg-blue-500/10 text-blue-500 ring-blue-500/30',
};

export function AlertsPanel() {
  const { data, isLoading, isError } = useDashboardAlerts();

  const items: AlertItem[] = [];

  if (data && data.stockoutsCount > 0) {
    items.push({
      icon: PackageX,
      message: `${data.stockoutsCount} stockouts críticos (en cero con ventas recientes)`,
      href: ROUTES.ARTICLES,
      severity: 'high',
    });
  }

  if (data && data.lateProformasCount > 0) {
    items.push({
      icon: FileWarning,
      message: `${data.lateProformasCount} proformas con entrega vencida`,
      href: ROUTES.SUPPLIER_ORDERS,
      severity: 'medium',
    });
  }

  if (data && data.pendingQuotesCount > 0) {
    items.push({
      icon: Timer,
      message: `${data.pendingQuotesCount} pedidos pendientes hace +14 días`,
      href: ROUTES.SALES_ORDERS,
      severity: 'low',
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Alertas Activas
        </CardTitle>
        <CardDescription>Cosas que requieren atención hoy</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="bg-muted/40 h-12 w-full animate-pulse rounded-md" />
            <div className="bg-muted/40 h-12 w-full animate-pulse rounded-md" />
          </div>
        ) : isError ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No se pudieron cargar las alertas
          </p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Sin alertas activas — todo en orden
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Link
                  key={idx}
                  href={item.href}
                  className="hover:bg-accent flex items-center gap-3 rounded-md border p-3 transition-colors"
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ring-1 ${severityRing[item.severity]}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm">{item.message}</p>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
