'use client';

import { Card, CardContent } from '@/components/ui/card';

interface Kpis {
  avgCob: number;
  maxMonth: { mes: string; usd: number } | null;
  grossMarginPct: number;
  grossMarginAnnual: number;
  breakEvenMonthly: number;
  breakEvenAnnual: number;
  utilidadPropuesta: number;
}

interface KpiCardsProps {
  kpis: Kpis;
}

function fU(n: number): string {
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? '-$' : '$') + abs.toLocaleString('en-US');
}

function fP(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function fM(mes: string): string {
  if (!mes) return '';
  const [y, m] = mes.split('-');
  const ms = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return ms[parseInt(m, 10) - 1] + " '" + y.slice(2);
}

export function KpiCards({ kpis }: KpiCardsProps) {
  const items = [
    {
      label: 'Cobranza prom. 12m',
      value: fU(kpis.avgCob),
      sub: 'mensual USD',
    },
    {
      label: 'Mejor mes',
      value: kpis.maxMonth ? fU(kpis.maxMonth.usd) : '-',
      sub: kpis.maxMonth ? fM(kpis.maxMonth.mes) : '',
    },
    {
      label: 'Margen bruto',
      value: fP(kpis.grossMarginPct),
      sub: fU(kpis.grossMarginAnnual) + ' anual',
    },
    {
      label: 'Break-even',
      value: fU(kpis.breakEvenMonthly) + '/m',
      sub: fU(kpis.breakEvenAnnual) + ' anual',
    },
    {
      label: 'Utilidad propuesta',
      value: fU(kpis.utilidadPropuesta),
      sub: kpis.utilidadPropuesta >= 0 ? 'ganancia' : 'pérdida',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {items.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-3">
            <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              {kpi.label}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums">{kpi.value}</p>
            <p className="text-muted-foreground mt-0.5 text-[10px]">{kpi.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
