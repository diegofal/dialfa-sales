'use client';

import { AlertCircle, ArrowDown, ArrowUp, Loader2, Minus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStockTransitions } from '@/lib/hooks/domain/useStockTransitions';
import { ArticleTransition } from '@/types/stockTransitions';
import { StockStatus } from '@/types/stockValuation';
import { StockStatusBadge } from './StockStatusBadge';
import { TransitionMatrix } from './TransitionMatrix';
import { TransitionsList } from './TransitionsList';

const PERIOD_OPTIONS = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

function formatDateLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR', { timeZone: 'UTC' });
}

export function StockTransitionsPanel() {
  const [periodDays, setPeriodDays] = useState(30);
  const [cellFilter, setCellFilter] = useState<{
    from: StockStatus;
    to: StockStatus;
  } | null>(null);

  const fromDate = useMemo(() => isoDaysAgo(periodDays), [periodDays]);
  const { data, isLoading, error } = useStockTransitions({ fromDate });

  const filteredTransitions = useMemo<ArticleTransition[]>(() => {
    if (!data) return [];
    if (!cellFilter) return data.transitions;
    return data.transitions.filter(
      (t) => t.fromStatus === cellFilter.from && t.toStatus === cellFilter.to
    );
  }, [data, cellFilter]);

  const handleCellClick = (from: StockStatus, to: StockStatus) => {
    if (cellFilter && cellFilter.from === from && cellFilter.to === to) {
      setCellFilter(null);
    } else {
      setCellFilter({ from, to });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => {
                  setPeriodDays(opt.days);
                  setCellFilter(null);
                }}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  periodDays === opt.days
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                Últimos {opt.label}
              </button>
            ))}
            {data && (
              <span className="text-muted-foreground ml-2 text-xs">
                Comparando {formatDateLabel(data.actualFromDate)} →{' '}
                {formatDateLabel(data.actualToDate)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Calculando transiciones...</p>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No se pudieron cargar las transiciones de stock. Intentá nuevamente.
          </AlertDescription>
        </Alert>
      )}

      {data && !isLoading && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              icon={<ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />}
              label="Mejoras"
              value={data.totalsByDirection.upgrades}
              hint="dead → slow → active"
            />
            <SummaryCard
              icon={<ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />}
              label="Deterioros"
              value={data.totalsByDirection.downgrades}
              hint="active → slow → dead"
            />
            <SummaryCard
              icon={<Minus className="text-muted-foreground h-4 w-4" />}
              label="Laterales"
              value={data.totalsByDirection.sideways}
              hint="involucra never_sold"
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Matriz de transiciones</h3>
            <p className="text-muted-foreground text-xs">
              Hacé clic en una celda con datos para filtrar la lista.
            </p>
            <TransitionMatrix
              matrix={data.matrix}
              selectedFromStatus={cellFilter?.from}
              selectedToStatus={cellFilter?.to}
              onCellClick={handleCellClick}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium">
                  {cellFilter ? 'Artículos en la transición' : 'Todos los artículos'}
                </h3>
                {cellFilter && (
                  <div className="flex items-center gap-1 text-sm">
                    <StockStatusBadge status={cellFilter.from} />
                    <span className="text-muted-foreground">→</span>
                    <StockStatusBadge status={cellFilter.to} />
                    <button
                      type="button"
                      onClick={() => setCellFilter(null)}
                      className="text-primary ml-2 text-xs hover:underline"
                    >
                      Limpiar filtro
                    </button>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {filteredTransitions.length} artículo
                {filteredTransitions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <TransitionsList transitions={filteredTransitions} />
          </div>
        </>
      )}
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}

function SummaryCard({ icon, label, value, hint }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs tracking-wider uppercase">
            {icon}
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
          <div className="text-muted-foreground text-xs">{hint}</div>
        </div>
      </CardContent>
    </Card>
  );
}
