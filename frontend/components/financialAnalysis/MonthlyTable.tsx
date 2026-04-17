'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { CalcRow } from '@/types/financialAnalysis';

interface MonthlyTableProps {
  rows: CalcRow[];
}

function fU(n: number): string {
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? '-$' : '$') + abs.toLocaleString('en-US');
}

function fM(mes: string): string {
  if (!mes) return '';
  const [y, m] = mes.split('-');
  const ms = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return ms[parseInt(m, 10) - 1] + " '" + y.slice(2);
}

export function MonthlyTable({ rows }: MonthlyTableProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Tabla Mensual
        </h3>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0">
              <tr className="text-muted-foreground bg-card border-b text-[9px] uppercase">
                <th className="px-1.5 py-1 text-left">Mes</th>
                <th className="px-1.5 py-1 text-right">Facturado</th>
                <th className="px-1.5 py-1 text-right">Cobrado</th>
                <th className="px-1.5 py-1 text-right">Margen Op</th>
                <th className="px-1.5 py-1 text-right">Excedente</th>
                <th className="px-1.5 py-1 text-right">Variable</th>
                <th className="px-1.5 py-1 text-right">Nom. Prop.</th>
                <th className="px-1.5 py-1 text-right">% prop</th>
                <th className="px-1.5 py-1 text-right">Delta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                let bgClass = '';
                if (r.projected) bgClass = 'bg-green-500/5 border-l-2 border-l-green-500/40';
                else if (r.capHit) bgClass = 'bg-red-500/5';

                return (
                  <tr key={r.mes} className={`border-border/30 border-b ${bgClass}`}>
                    <td className="px-1.5 py-1">
                      {fM(r.mes)}
                      {r.projected && (
                        <span className="ml-1 text-[9px] font-semibold text-green-500">PROY</span>
                      )}
                      {r.hasRealCosts && !r.projected && (
                        <span className="ml-1 text-[9px] font-semibold text-blue-400">REAL</span>
                      )}
                    </td>
                    <td className="px-1.5 py-1 text-right tabular-nums">
                      {r.projected ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        fU(r.revFact)
                      )}
                    </td>
                    <td className="px-1.5 py-1 text-right tabular-nums">
                      {r.projected ? fU(r.rev) : fU(r.revCob)}
                    </td>
                    <td
                      className={`px-1.5 py-1 text-right tabular-nums ${r.mo >= 0 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {fU(r.mo)}
                    </td>
                    <td className="px-1.5 py-1 text-right tabular-nums">
                      {r.isEnd ? fU(r.exc) : '-'}
                    </td>
                    <td className="px-1.5 py-1 text-right tabular-nums">
                      {r.isEnd ? fU(r.poolP) : '-'}
                    </td>
                    <td className="px-1.5 py-1 text-right tabular-nums">{fU(r.nomP)}</td>
                    <td className="px-1.5 py-1 text-right tabular-nums">
                      {(r.pctP * 100).toFixed(1)}%
                    </td>
                    <td
                      className={`px-1.5 py-1 text-right tabular-nums ${r.delta >= 0 ? 'text-red-500' : 'text-green-500'}`}
                    >
                      {(r.delta >= 0 ? '+$' : '-$') +
                        Math.abs(Math.round(r.delta)).toLocaleString('en-US')}
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
