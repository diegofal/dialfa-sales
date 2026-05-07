'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { BarChart3, Percent } from 'lucide-react';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ChartPoint {
  month: string;
  units: number;
  revenueUsd: number;
  revenueArs: number;
  cogsUsd: number;
  marginPercent: number | null;
}

interface ChartsResponse {
  data: ChartPoint[];
  months: number;
}

const SHORT_MONTHS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const formatLabel = (yyyymm: string): string => {
  const [y, m] = yyyymm.split('-').map((n) => parseInt(n, 10));
  return `${SHORT_MONTHS[m - 1]} ${String(y).slice(-2)}`;
};

const formatUsd = (n: number): string =>
  n >= 1000 ? `US$${(n / 1000).toFixed(1)}K` : `US$${n.toFixed(0)}`;

function SalesTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <p className="mb-1 font-semibold">{formatLabel(d.month)}</p>
      <p className="text-sm">Vendido: {new Intl.NumberFormat('es-AR').format(d.units)} u</p>
      <p className="text-sm">Revenue: {formatUsd(d.revenueUsd)}</p>
      <p className="text-muted-foreground text-sm">COGS: {formatUsd(d.cogsUsd)}</p>
    </div>
  );
}

function MarginTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <p className="mb-1 font-semibold">{formatLabel(d.month)}</p>
      <p className="text-sm">
        Margen: {d.marginPercent != null ? `${d.marginPercent.toFixed(1)}%` : 's/d'}
      </p>
      <p className="text-muted-foreground text-sm">Revenue: {formatUsd(d.revenueUsd)}</p>
      <p className="text-muted-foreground text-sm">COGS: {formatUsd(d.cogsUsd)}</p>
    </div>
  );
}

interface Props {
  articleId: number;
}

export function ArticleChartsTab({ articleId }: Props) {
  const [months, setMonths] = useState(24);

  const { data, isLoading, isError } = useQuery<ChartsResponse>({
    queryKey: ['article', articleId, 'charts', months],
    queryFn: async () => {
      const response = await axios.get(`/api/articles/${articleId}/charts?months=${months}`);
      return response.data;
    },
    enabled: articleId > 0,
  });

  const chartData = data?.data ?? [];
  const isEmpty = !isLoading && !isError && chartData.length === 0;

  const headerActions = (
    <Select value={String(months)} onValueChange={(v) => setMonths(parseInt(v, 10))}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="6">6 meses</SelectItem>
        <SelectItem value="12">12 meses</SelectItem>
        <SelectItem value="24">24 meses</SelectItem>
        <SelectItem value="36">36 meses</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="h-4 w-4" />
            Gráficos del artículo
          </h2>
          <p className="text-muted-foreground text-sm">
            Tendencia de ventas (unidades + revenue) y margen mensual
          </p>
        </div>
        {headerActions}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas mensuales</CardTitle>
            <CardDescription>Unidades vendidas y revenue (USD)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="bg-muted/40 h-[280px] w-full animate-pulse rounded-md" />
            ) : isError ? (
              <div className="text-muted-foreground flex h-[280px] items-center justify-center text-sm">
                Error al cargar
              </div>
            ) : isEmpty ? (
              <div className="text-muted-foreground flex h-[280px] items-center justify-center text-sm">
                Sin ventas en el período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="articleSalesUnits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatLabel}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    stroke="#475569"
                  />
                  <YAxis
                    yAxisId="units"
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    stroke="#475569"
                    width={40}
                  />
                  <YAxis
                    yAxisId="revenue"
                    orientation="right"
                    tickFormatter={formatUsd}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    stroke="#475569"
                    width={60}
                  />
                  <Tooltip content={<SalesTooltip />} />
                  <Bar yAxisId="units" dataKey="units" fill="url(#articleSalesUnits)" />
                  <Line
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="revenueUsd"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#3b82f6' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Percent className="h-4 w-4" />
              Margen mensual
            </CardTitle>
            <CardDescription>(Revenue − COGS) / Revenue × 100</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="bg-muted/40 h-[280px] w-full animate-pulse rounded-md" />
            ) : isError ? (
              <div className="text-muted-foreground flex h-[280px] items-center justify-center text-sm">
                Error al cargar
              </div>
            ) : isEmpty ? (
              <div className="text-muted-foreground flex h-[280px] items-center justify-center text-sm">
                Sin ventas en el período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="articleMargin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatLabel}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    stroke="#475569"
                  />
                  <YAxis
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    stroke="#475569"
                    width={50}
                  />
                  <Tooltip content={<MarginTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="marginPercent"
                    stroke="#a855f7"
                    fill="url(#articleMargin)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#a855f7' }}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
