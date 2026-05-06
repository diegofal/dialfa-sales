/**
 * Commercial Pulse Row (Fila 1)
 * 4 KPI cards with comparison deltas: facturado mes, facturado hoy, a cobrar, margen bruto.
 * Reads from Postgres sync_* tables (mirrors xERP). When the query fails, every
 * numeric field is null and a single banner shows the underlying error.
 */

'use client';

import { AlertTriangle, Calendar, FileText, Percent, Wallet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { computeDelta, formatCurrency, useDashboardMetrics } from '@/lib/hooks/domain/useDashboard';
import { DeltaChip } from './DeltaChip';
import { MetricCard } from './MetricCard';

const formatOrDash = (value: number | null): string =>
  value === null ? '—' : formatCurrency(value);

export function DashboardMetrics() {
  const { data: metrics, isLoading, isError, error } = useDashboardMetrics();

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error al cargar las métricas: {error?.message || 'Error desconocido'}
        </AlertDescription>
      </Alert>
    );
  }

  const currentMonth = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date());
  const monthCapitalized = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const dataError = metrics?.error ?? null;

  const billedMonthly = metrics?.billedMonthly ?? null;
  const billedToday = metrics?.billedToday ?? null;
  const dailyAverage = metrics?.dailyAverageThisMonth ?? null;
  const totalOutstanding = metrics?.totalOutstanding ?? null;
  const totalOverdue = metrics?.totalOverdue ?? null;
  const overduePercent =
    totalOutstanding && totalOutstanding > 0 && totalOverdue !== null
      ? (totalOverdue / totalOutstanding) * 100
      : null;

  const deltaVsPrevMonth = computeDelta(billedMonthly, metrics?.billedPrevMonth ?? null);
  const deltaVsSameMonthPrevYear = computeDelta(
    billedMonthly,
    metrics?.billedSameMonthPrevYear ?? null
  );
  const todayVsAvg = computeDelta(billedToday, dailyAverage);
  const marginDelta =
    metrics?.grossMarginPercent != null && metrics.grossMarginPrevPercent != null
      ? metrics.grossMarginPercent - metrics.grossMarginPrevPercent
      : null;

  return (
    <div className="space-y-3">
      {dataError && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm">
            <strong>No se pudieron cargar las métricas comerciales:</strong> {dataError}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title={`Facturado ${monthCapitalized}`}
          value={formatOrDash(billedMonthly)}
          subtitle={billedMonthly === null ? 'Sin datos' : undefined}
          icon={FileText}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          loading={isLoading}
        >
          {billedMonthly !== null && (
            <div className="mt-1 space-y-1">
              <DeltaChip delta={deltaVsPrevMonth} label="vs mes ant." />
              <div>
                <DeltaChip delta={deltaVsSameMonthPrevYear} label="vs año ant." />
              </div>
            </div>
          )}
        </MetricCard>

        <MetricCard
          title="Facturado Hoy"
          value={formatOrDash(billedToday)}
          subtitle={
            billedToday === null
              ? 'Sin datos'
              : dailyAverage !== null
                ? `Promedio diario: ${formatCurrency(dailyAverage)}`
                : undefined
          }
          icon={Calendar}
          gradient="bg-gradient-to-br from-teal-500 to-teal-700"
          loading={isLoading}
        >
          {todayVsAvg !== null && (
            <div className="mt-1">
              <DeltaChip delta={todayVsAvg} label="vs prom." />
            </div>
          )}
        </MetricCard>

        <MetricCard
          title="A Cobrar"
          value={formatOrDash(totalOutstanding)}
          subtitle={
            totalOutstanding === null
              ? 'Sin datos'
              : totalOverdue !== null
                ? `En mora: ${formatCurrency(totalOverdue)}`
                : undefined
          }
          icon={Wallet}
          gradient={
            totalOutstanding === null
              ? 'bg-gradient-to-br from-slate-500 to-slate-700'
              : overduePercent !== null && overduePercent > 25
                ? 'bg-gradient-to-br from-red-500 to-red-700'
                : 'bg-gradient-to-br from-amber-500 to-amber-700'
          }
          loading={isLoading}
        >
          {overduePercent !== null && (
            <div className="mt-1 text-xs opacity-90">
              {overduePercent.toFixed(1)}% del total vencido
            </div>
          )}
        </MetricCard>

        <MetricCard
          title="Margen Bruto del Mes"
          value={
            metrics?.grossMarginPercent != null ? `${metrics.grossMarginPercent.toFixed(1)}%` : '—'
          }
          subtitle={
            metrics?.grossMarginAmountArs != null
              ? formatCurrency(metrics.grossMarginAmountArs)
              : 'Sin facturas en el mes'
          }
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
