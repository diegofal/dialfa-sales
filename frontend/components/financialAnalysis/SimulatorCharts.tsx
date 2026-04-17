'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import type { CalcResult } from '@/types/financialAnalysis';

interface SimulatorChartsProps {
  calcResult: CalcResult;
}

function fM(mes: string): string {
  if (!mes) return '';
  const [y, m] = mes.split('-');
  const ms = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return ms[parseInt(m, 10) - 1] + "'" + y.slice(2);
}

export function SimulatorCharts({ calcResult: R }: SimulatorChartsProps) {
  const fijoActual = R.act.fijo * (1 + R.payrollTax);
  const fijoProp = R.prop.fijo * (1 + R.payrollTax);

  const payrollData = R.rows.map((r) => ({
    mes: fM(r.mes),
    fijoPropuesto: Math.round(fijoProp),
    variable: Math.round(r.poolP * (1 + R.payrollTax)),
    fijoActual: Math.round(fijoActual),
  }));

  const pctData = R.rows.map((r) => ({
    mes: fM(r.mes),
    pctActual: +(r.pctA * 100).toFixed(2),
    pctPropuesta: +(r.pctP * 100).toFixed(2),
    tope: +(R.capTot * 100),
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Chart 1: Payroll stacked bar */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
            Nómina propuesta (fijo + variable)
          </h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payrollData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                <YAxis
                  tick={{ fontSize: 9 }}
                  tickFormatter={(v: number) => '$' + (v / 1000).toFixed(0) + 'k'}
                />
                { }
                <Tooltip
                  formatter={
                    ((v: number, name: string) => [
                      '$' + v.toLocaleString('en-US'),
                      name === 'fijoPropuesto'
                        ? 'Fijo propuesto'
                        : name === 'variable'
                          ? 'Variable'
                          : 'Fijo actual',
                    ]) as any
                  }
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Legend
                  formatter={(v: string) =>
                    v === 'fijoPropuesto'
                      ? 'Fijo propuesto'
                      : v === 'variable'
                        ? 'Variable'
                        : 'Fijo actual'
                  }
                  wrapperStyle={{ fontSize: '10px' }}
                />
                <Bar dataKey="fijoPropuesto" stackId="prop" fill="#3b82f6" />
                <Bar dataKey="variable" stackId="prop" fill="#10b981" />
                <Line
                  type="monotone"
                  dataKey="fijoActual"
                  stroke="#94a3b8"
                  strokeDasharray="5 5"
                  dot={false}
                  strokeWidth={2}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Chart 2: % payroll over revenue */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
            % nómina s/facturación
          </h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pctData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                <YAxis
                  tick={{ fontSize: 9 }}
                  tickFormatter={(v: number) => v + '%'}
                  domain={[0, 'auto']}
                />
                { }
                <Tooltip
                  formatter={
                    ((v: number, name: string) => [
                      v.toFixed(1) + '%',
                      name === 'pctActual'
                        ? '% actual'
                        : name === 'pctPropuesta'
                          ? '% propuesta'
                          : 'Tope',
                    ]) as any
                  }
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Legend
                  formatter={(v: string) =>
                    v === 'pctActual' ? '% actual' : v === 'pctPropuesta' ? '% propuesta' : 'Tope'
                  }
                  wrapperStyle={{ fontSize: '10px' }}
                />
                <Line
                  type="monotone"
                  dataKey="pctActual"
                  stroke="#94a3b8"
                  dot={{ r: 2 }}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="pctPropuesta"
                  stroke="#a855f7"
                  fill="rgba(168,85,247,0.15)"
                  dot={{ r: 3 }}
                  strokeWidth={2}
                />
                <ReferenceLine
                  y={R.capTot * 100}
                  stroke="#ef4444"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{ value: 'Tope', position: 'right', fill: '#ef4444', fontSize: 10 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
