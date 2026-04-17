'use client';

import type { CalcRow } from '@/types/financialAnalysis';

interface DataSourceBadgeProps {
  rows: CalcRow[];
}

export function DataSourceBadge({ rows }: DataSourceBadgeProps) {
  // Consider only last 12 real (non-projected) months for the summary
  const last12 = rows.filter((r) => !r.projected).slice(-12);
  const realCount = last12.filter((r) => r.hasRealCosts).length;
  const simCount = last12.length - realCount;
  const allReal = realCount === last12.length && last12.length > 0;
  const noneReal = realCount === 0;

  const realMonths = last12.filter((r) => r.hasRealCosts).map((r) => r.mes);
  const realRange =
    realMonths.length > 0 ? `${realMonths[0]} → ${realMonths[realMonths.length - 1]}` : '';

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-xs ${
        allReal
          ? 'border-blue-500/50 bg-blue-500/5'
          : noneReal
            ? 'border-amber-500/50 bg-amber-500/5'
            : 'border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-amber-500/5'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        <span>
          <strong className="text-blue-400">{realCount}</strong> mes{realCount === 1 ? '' : 'es'}{' '}
          con <strong>datos reales</strong>
          {realRange && <span className="text-muted-foreground ml-1">({realRange})</span>}
        </span>
      </div>

      {simCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>
            <strong className="text-amber-500">{simCount}</strong> mes{simCount === 1 ? '' : 'es'}{' '}
            con <strong>estimaciones</strong> (usa los defaults del panel)
          </span>
        </div>
      )}

      {noneReal && (
        <span className="text-muted-foreground">
          Importá los Excel para ver costos reales mes a mes
        </span>
      )}
    </div>
  );
}
