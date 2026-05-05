/**
 * Operational Pulse Row (Fila 2)
 * 4 KPI cards: stock valorizado, capital muerto, stockouts críticos, a facturar.
 */

'use client';

import { AlertTriangle, FileClock, PackageX, Skull, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ROUTES } from '@/lib/constants/routes';
import { formatCurrency, useOperationalMetrics } from '@/lib/hooks/domain/useDashboard';
import { MetricCard } from './MetricCard';

const formatUsd = (value: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function OperationalMetrics() {
  const { data: metrics, isLoading, isError, error } = useOperationalMetrics();

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error al cargar métricas operativas: {error?.message || 'Error desconocido'}
        </AlertDescription>
      </Alert>
    );
  }

  const stockCostUsd = metrics?.stockValueCostUsd ?? 0;
  const stockRetailArs = metrics?.stockValueRetailArs ?? 0;
  const deadStockArs = metrics?.deadStockValueArs ?? 0;
  const deadStockCount = metrics?.deadStockArticleCount ?? 0;
  const stockoutsCount = metrics?.stockoutsCriticalCount ?? 0;
  const pendingCount = metrics?.pendingToInvoiceCount ?? 0;
  const pendingArs = metrics?.pendingToInvoiceArs ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Stock Valorizado"
        value={formatUsd(stockCostUsd)}
        subtitle={`A precio venta: ${formatCurrency(stockRetailArs)}`}
        icon={Warehouse}
        gradient="bg-gradient-to-br from-blue-500 to-blue-700"
        loading={isLoading}
      >
        <div className="mt-1 text-xs opacity-90">A costo CIF (USD landed)</div>
      </MetricCard>

      <Link
        href={ROUTES.ARTICLES}
        className="block transition-transform hover:scale-[1.02]"
        title="Ver artículos"
      >
        <MetricCard
          title="Capital Muerto"
          value={formatCurrency(deadStockArs)}
          subtitle={`${deadStockCount} artículos sin venta hace +1 año`}
          icon={Skull}
          gradient="bg-gradient-to-br from-zinc-600 to-zinc-800"
          loading={isLoading}
        />
      </Link>

      <Link
        href={ROUTES.ARTICLES}
        className="block transition-transform hover:scale-[1.02]"
        title="Ver artículos sin stock"
      >
        <MetricCard
          title="Stockouts Críticos"
          value={String(stockoutsCount)}
          subtitle={stockoutsCount === 0 ? 'Sin alertas' : 'Artículos en cero con ventas recientes'}
          icon={PackageX}
          gradient={
            stockoutsCount > 0
              ? 'bg-gradient-to-br from-red-500 to-red-700'
              : 'bg-gradient-to-br from-slate-500 to-slate-700'
          }
          loading={isLoading}
        />
      </Link>

      <Link
        href={ROUTES.SALES_ORDERS}
        className="block transition-transform hover:scale-[1.02]"
        title="Ver pedidos pendientes"
      >
        <MetricCard
          title="A Facturar"
          value={String(pendingCount)}
          subtitle={`${formatCurrency(pendingArs)} en backlog`}
          icon={FileClock}
          gradient="bg-gradient-to-br from-orange-500 to-orange-700"
          loading={isLoading}
        />
      </Link>
    </div>
  );
}
