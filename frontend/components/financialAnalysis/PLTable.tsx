'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { PLRow } from '@/lib/utils/financialCalc';

interface PLTableProps {
  rows: PLRow[];
  hasProjected: boolean;
  projectedRevenue: number;
  hasRealCosts?: boolean;
  realMonths?: number;
  totalMonths?: number;
}

function fU(n: number): string {
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? '-$' : '$') + abs.toLocaleString('en-US');
}

function fSU(n: number): string {
  const abs = Math.abs(Math.round(n));
  return (n >= 0 ? '+$' : '-$') + abs.toLocaleString('en-US');
}

function fP(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function dataSourceBadge(source?: 'real' | 'mixed' | 'estimated') {
  if (!source || source === 'estimated') {
    return (
      <span
        className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-bold text-amber-500 uppercase"
        title="Calculado con los valores del panel de configuración"
      >
        EST
      </span>
    );
  }
  if (source === 'real') {
    return (
      <span
        className="rounded bg-blue-500/15 px-1 py-0.5 text-[8px] font-bold text-blue-400 uppercase"
        title="Basado en datos reales importados para todos los meses"
      >
        REAL
      </span>
    );
  }
  return (
    <span
      className="rounded bg-gradient-to-r from-blue-500/15 to-amber-500/15 px-1 py-0.5 text-[8px] font-bold text-blue-400 uppercase"
      title="Mezcla de datos reales (meses importados) y estimados (resto)"
    >
      MIX
    </span>
  );
}

export function PLTable({
  rows,
  hasProjected,
  projectedRevenue,
  hasRealCosts,
  realMonths = 0,
  totalMonths = 12,
}: PLTableProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            P&L Anual (12m)
          </h3>
          {hasRealCosts && (
            <span className="text-muted-foreground text-[10px]">
              <strong className="text-blue-400">{realMonths}</strong>/{totalMonths} meses con datos
              reales
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b text-[9px] uppercase">
                <th className="px-1.5 py-1 text-left"></th>
                <th className="px-1.5 py-1 text-right">Actual</th>
                <th className="px-1.5 py-1 text-right">Propuesta</th>
                <th className="px-1.5 py-1 text-right">Delta</th>
              </tr>
            </thead>
            <tbody>
              {hasRealCosts && (
                <tr>
                  <td
                    colSpan={4}
                    className="rounded bg-blue-500/5 px-1.5 py-1 text-center text-[11px] text-blue-400"
                  >
                    Costos fijos / variables / retiros: {realMonths} meses con datos reales
                    importados, {totalMonths - realMonths} meses con estimaciones del panel
                  </td>
                </tr>
              )}
              {hasProjected && (
                <tr>
                  <td
                    colSpan={4}
                    className="rounded bg-green-500/5 px-1.5 py-1 text-center text-[11px] text-green-500"
                  >
                    Incluye meses proyectados a ${Math.round(projectedRevenue).toLocaleString()}/mes
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const fmt = row.isPct ? fP : fU;
                const deltaFmt = row.isPct ? fP : fSU;
                const deltaColor = row.isPct
                  ? row.delta >= 0
                    ? 'text-red-500'
                    : 'text-green-500'
                  : row.delta >= 0
                    ? 'text-green-500'
                    : 'text-red-500';

                let trClass = 'border-b border-border/30';
                if (row.isBold) trClass += ' font-semibold border-t-2 border-border';
                if (row.isHighlight) trClass += ' font-bold border-t-2 border-blue-500';

                return (
                  <tr key={row.label} className={trClass}>
                    <td className="px-1.5 py-1">
                      <span className="inline-flex items-center gap-1.5">
                        {row.label}
                        {row.dataSource && dataSourceBadge(row.dataSource)}
                      </span>
                    </td>
                    <td
                      className={`px-1.5 py-1 text-right tabular-nums ${
                        row.isHighlight ? (row.actual >= 0 ? 'text-green-500' : 'text-red-500') : ''
                      }`}
                    >
                      {fmt(row.actual)}
                    </td>
                    <td
                      className={`px-1.5 py-1 text-right tabular-nums ${
                        row.isHighlight
                          ? row.propuesta >= 0
                            ? 'text-green-500'
                            : 'text-red-500'
                          : ''
                      }`}
                    >
                      {fmt(row.propuesta)}
                    </td>
                    <td className={`px-1.5 py-1 text-right tabular-nums ${deltaColor}`}>
                      {row.delta === 0 && !row.isPct ? '-' : deltaFmt(row.delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
