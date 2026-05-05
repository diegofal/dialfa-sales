/**
 * Commercial Pulse Row (Fila 1)
 * 4 KPI cards with comparison deltas: facturado mes, facturado hoy, a cobrar, margen bruto.
 */

'use client';

import { AlertTriangle, Calendar, FileText, Percent, Wallet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { computeDelta, formatCurrency, useDashboardMetrics } from '@/lib/hooks/domain/useDashboard';
import { DeltaChip } from './DeltaChip';
import { MetricCard } from './MetricCard';

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

  const billedMonthly = metrics?.billedMonthly ?? 0;
  const billedToday = metrics?.billedToday ?? 0;
  const dailyAverage = metrics?.dailyAverageThisMonth ?? 0;
  const totalOutstanding = metrics?.totalOutstanding ?? 0;
  const totalOverdue = metrics?.totalOverdue ?? 0;
  const overduePercent = totalOutstanding > 0 ? (totalOverdue / totalOutstanding) * 100 : 0;

  const deltaVsPrevMonth = metrics ? computeDelta(billedMonthly, metrics.billedPrevMonth) : null;
  const deltaVsSameMonthPrevYear = metrics
    ? computeDelta(billedMonthly, metrics.billedSameMonthPrevYear)
    : null;
  const todayVsAvg = dailyAverage > 0 ? computeDelta(billedToday, dailyAverage) : null;
  const marginDelta =
    metrics?.grossMarginPercent != null && metrics.grossMarginPrevPercent != null
      ? metrics.grossMarginPercent - metrics.grossMarginPrevPercent
      : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title={`Facturado ${monthCapitalized}`}
        value={formatCurrency(billedMonthly)}
        icon={FileText}
        gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
        loading={isLoading}
      >
        <div className="mt-1 space-y-1">
          <DeltaChip delta={deltaVsPrevMonth} label="vs mes ant." />
          <div>
            <DeltaChip delta={deltaVsSameMonthPrevYear} label="vs año ant." />
          </div>
        </div>
      </MetricCard>

      <MetricCard
        title="Facturado Hoy"
        value={formatCurrency(billedToday)}
        subtitle={`Promedio diario: ${formatCurrency(dailyAverage)}`}
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
        value={formatCurrency(totalOutstanding)}
        subtitle={`En mora: ${formatCurrency(totalOverdue)}`}
        icon={Wallet}
        gradient={
          overduePercent > 25
            ? 'bg-gradient-to-br from-red-500 to-red-700'
            : 'bg-gradient-to-br from-amber-500 to-amber-700'
        }
        loading={isLoading}
      >
        <div className="mt-1 text-xs opacity-90">
          {overduePercent.toFixed(1)}% del total vencido
        </div>
      </MetricCard>

      <MetricCard
        title="Margen Bruto del Mes"
        value={
          metrics?.grossMarginPercent != null ? `${metrics.grossMarginPercent.toFixed(1)}%` : 's/d'
        }
        subtitle={
          metrics?.grossMarginAmountArs != null
            ? formatCurrency(metrics.grossMarginAmountArs)
            : 'Sin facturas SPISA en el mes'
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
  );
}
