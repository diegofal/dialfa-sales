'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StockEvolutionPoint } from '@/types/salesAnalytics';

interface StockEvolutionChartProps {
  data: StockEvolutionPoint[];
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
  payload: StockEvolutionPoint;
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
      <p className="text-sm">Valor de Stock: {formatFullCurrency(data.totalStockValue)}</p>
    </div>
  );
}

export function StockEvolutionChart({ data }: StockEvolutionChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolución de Stock (USD)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-[300px] items-center justify-center">
            No hay datos de movimientos de stock
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evolución del Valor de Stock (USD)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="#475569" />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              stroke="#475569"
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="totalStockValue"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={{ r: 3, fill: '#38bdf8', stroke: '#38bdf8' }}
              activeDot={{ r: 5, fill: '#38bdf8' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
