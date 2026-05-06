/**
 * Operational Pulse Row (Fila 2) — 4 cards backed by canonical SPISA services:
 *
 * - Stock Valorizado: `calculateStockValuation().totals` (same totals shown on
 *   /dashboard/articles/valuation).
 * - Capital Muerto: `byStatus[DEAD_STOCK] + byStatus[NEVER_SOLD]` from the
 *   same valuation. Matches the dead-stock view.
 * - Stockouts con Demanda: articles with stock <= 0 sold in last 180 days
 *   (matches scripts/stock_rotation_spisa.py "stockouts críticos").
 * - Margen Bruto del Mes: from invoice_items × articles, USD-based.
 */

'use client';

import { AlertTriangle, PackageX, Percent, Skull, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ROUTES } from '@/lib/constants/routes';
import {
  formatCurrency,
  useDashboardMetrics,
  useOperationalMetrics,
} from '@/lib/hooks/domain/useDashboard';
import { DeltaChip } from './DeltaChip';
import { MetricCard } from './MetricCard';

export function OperationalMetrics() {
  const opQuery = useOperationalMetrics();
  const metricsQuery = useDashboardMetrics();

  const op = opQuery.data;
  const metrics = metricsQuery.data;
  const isLoading = opQuery.isLoading || metricsQuery.isLoading;
  const opError = opQuery.isError ? opQuery.error?.message : (op?.error ?? null);

  const stockCost = op?.stockValueCost ?? null;
  const stockRetail = op?.stockValueRetail ?? null;
  const deadValue = op?.deadStockValue ?? null;
  const deadCount = op?.deadStockArticleCount ?? 0;
  const stockouts = op?.stockoutsCriticalCount ?? null;

  const marginPct = metrics?.grossMarginPercent ?? null;
  const marginAmt = metrics?.grossMarginAmountArs ?? null;
  const marginPrev = metrics?.grossMarginPrevPercent ?? null;
  const marginDelta = marginPct !== null && marginPrev !== null ? marginPct - marginPrev : null;

  return (
    <div className="space-y-3">
      {opError && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm">
            <strong>Métricas operativas no disponibles:</strong> {opError}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Stock Valorizado */}
        <Link
          href={ROUTES.ARTICLES_VALUATION}
          className="block transition-transform hover:scale-[1.02]"
          title="Ver valorización de stock"
        >
          <MetricCard
            title="Stock Valorizado"
            value={stockCost === null ? '—' : formatCurrency(stockCost)}
            subtitle={
              stockRetail === null
                ? 'A costo CIF'
                : `A precio venta: ${formatCurrency(stockRetail)}`
            }
            icon={Warehouse}
            gradient="bg-gradient-to-br from-blue-500 to-blue-700"
            loading={isLoading}
          />
        </Link>

        {/* Capital Muerto (dead + never sold) */}
        <Link
          href={ROUTES.ARTICLES_VALUATION}
          className="block transition-transform hover:scale-[1.02]"
          title="Ver dead stock"
        >
          <MetricCard
            title="Capital Muerto"
            value={deadValue === null ? '—' : formatCurrency(deadValue)}
            subtitle={`${deadCount} artículos (dead + sin venta)`}
            icon={Skull}
            gradient="bg-gradient-to-br from-zinc-600 to-zinc-800"
            loading={isLoading}
          />
        </Link>

        {/* Stockouts con Demanda */}
        <Link
          href={ROUTES.ARTICLES}
          className="block transition-transform hover:scale-[1.02]"
          title="Sin stock pero con ventas en los últimos 6 meses"
        >
          <MetricCard
            title="Stockouts con Demanda"
            value={stockouts === null ? '—' : String(stockouts)}
            subtitle={stockouts === 0 ? 'Sin alertas' : 'Sin stock + ventas últimos 6 meses'}
            icon={PackageX}
            gradient={
              stockouts && stockouts > 0
                ? 'bg-gradient-to-br from-red-500 to-red-700'
                : 'bg-gradient-to-br from-slate-500 to-slate-700'
            }
            loading={isLoading}
          />
        </Link>

        {/* Margen Bruto del Mes */}
        <MetricCard
          title="Margen Bruto del Mes"
          value={marginPct !== null ? `${marginPct.toFixed(1)}%` : '—'}
          subtitle={marginAmt !== null ? formatCurrency(marginAmt) : 'Sin facturas en el mes'}
          icon={Percent}
          gradient="bg-gradient-to-br from-violet-500 to-violet-700"
          loading={isLoading}
        >
          {marginDelta !== null && (
            <div className="mt-1">
              <DeltaChip delta={marginDelta} label="pp vs mes ant." />
            </div>
          )}
        </MetricCard>
      </div>
    </div>
  );
}
