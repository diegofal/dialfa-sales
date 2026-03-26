'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RevenueByMonth } from '@/types/salesAnalytics';

interface RevenueChartProps {
  data: RevenueByMonth[];
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `US$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `US$${(value / 1000).toFixed(0)}K`;
  return `US$${value.toFixed(0)}`;
};

const formatFullCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface TooltipPayloadItem {
  value: number;
  payload: RevenueByMonth;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <p className="mb-1 font-semibold">{data.label}</p>
      <p className="text-sm">Ingresos: {formatFullCurrency(data.revenue)}</p>
      <p className="text-muted-foreground text-sm">
        {new Intl.NumberFormat('es-AR').format(data.units)} unidades
      </p>
      <p className="text-muted-foreground text-sm">{data.invoiceCount} facturas</p>
    </div>
  );
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingresos Mensuales (USD)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-[300px] items-center justify-center">
            No hay datos de ventas para el período seleccionado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ingresos Mensuales (USD)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="#475569" />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              stroke="#475569"
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#22c55e"
              fill="url(#revenueGradient)"
              strokeWidth={2}
              dot={{ r: 3, fill: '#22c55e', stroke: '#22c55e' }}
              activeDot={{ r: 5, fill: '#22c55e' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
