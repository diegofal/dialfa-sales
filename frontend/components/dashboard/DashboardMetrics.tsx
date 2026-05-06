/**
 * Commercial Pulse Row (Fila 1) — 6 cards mirroring dialfa-bi:
 * A Cobrar, En Mora, Facturado del Mes, Facturado Hoy, A Cobrar este Mes
 * (cobrado / pendiente), Cheques en Cartera.
 *
 * Data sources are split: xERP for billed* (NET of credit notes), SPISA
 * Postgres for everything else. Errors per source are surfaced as inline
 * banners; cards from the failing source render as "—".
 */

'use client';

import { AlertTriangle, Calendar, FileText, HandCoins, Wallet, WalletCards } from 'lucide-react';
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

  const xerpError = metrics?.errors?.xerp ?? null;
  const spisaError = metrics?.errors?.spisa ?? null;

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

  const toCollect = metrics?.toCollectMonthly ?? null;
  const checks = metrics?.checksInPortfolio ?? null;

  return (
    <div className="space-y-3">
      {(xerpError || spisaError) && (
        <Alert variant="default" className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-sm">
            {xerpError && (
              <div>
                <strong>xERP no disponible:</strong> {xerpError}. Los cards de Facturado no se
                pudieron cargar.
              </div>
            )}
            {spisaError && (
              <div>
                <strong>SPISA no disponible:</strong> {spisaError}. Cobranzas y saldos no se
                pudieron cargar.
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* 1. A Cobrar */}
        <MetricCard
          title="A Cobrar"
          value={formatOrDash(totalOutstanding)}
          subtitle={totalOutstanding === null ? 'Sin datos' : 'Total saldo deudor'}
          icon={Wallet}
          gradient={
            totalOutstanding === null
              ? 'bg-gradient-to-br from-slate-500 to-slate-700'
              : 'bg-gradient-to-br from-blue-500 to-blue-700'
          }
          loading={isLoading}
        />

        {/* 2. En Mora */}
        <MetricCard
          title="En Mora"
          value={formatOrDash(totalOverdue)}
          subtitle={
            totalOverdue === null
              ? 'Sin datos'
              : overduePercent !== null
                ? `${overduePercent.toFixed(1)}% del total`
                : undefined
          }
          icon={AlertTriangle}
          gradient={
            totalOverdue === null
              ? 'bg-gradient-to-br from-slate-500 to-slate-700'
              : overduePercent !== null && overduePercent > 25
                ? 'bg-gradient-to-br from-red-500 to-red-700'
                : 'bg-gradient-to-br from-amber-500 to-amber-700'
          }
          loading={isLoading}
        />

        {/* 3. Facturado del Mes (xERP NET) */}
        <MetricCard
          title={`Facturado ${monthCapitalized}`}
          value={formatOrDash(billedMonthly)}
          subtitle={billedMonthly === null ? 'xERP no disponible' : undefined}
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

        {/* 4. Facturado Hoy (xERP NET) */}
        <MetricCard
          title="Facturado Hoy"
          value={formatOrDash(billedToday)}
          subtitle={
            billedToday === null
              ? 'xERP no disponible'
              : dailyAverage !== null
                ? `Prom. diario: ${formatCurrency(dailyAverage)}`
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

        {/* 5. A Cobrar este Mes */}
        <MetricCard
          title={`A Cobrar ${monthCapitalized}`}
          value={formatOrDash(toCollect?.total ?? null)}
          subtitle={toCollect === null ? 'Sin datos' : 'Total proyectado'}
          icon={HandCoins}
          gradient="bg-gradient-to-br from-purple-500 to-purple-700"
          loading={isLoading}
        >
          {toCollect && (
            <div className="mt-2 space-y-0.5 text-xs opacity-90">
              <div className="flex justify-between gap-2">
                <span>Cobrado:</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(toCollect.cleared)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Pendiente:</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(toCollect.pending)}
                </span>
              </div>
            </div>
          )}
        </MetricCard>

        {/* 6. Cheques en Cartera */}
        <MetricCard
          title="Cheques en Cartera"
          value={formatOrDash(checks)}
          subtitle={checks === null ? 'Sin datos' : 'Pendientes de depositar'}
          icon={WalletCards}
          gradient="bg-gradient-to-br from-orange-500 to-orange-700"
          loading={isLoading}
        />
      </div>
    </div>
  );
}
