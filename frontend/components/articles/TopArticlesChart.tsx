'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TopArticle } from '@/types/salesAnalytics';

interface TopArticlesChartProps {
  data: TopArticle[];
}

type ViewMode = 'revenue' | 'units';

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
  payload: TopArticle;
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
      <p className="mb-1 font-semibold">
        {data.code} - {data.description}
      </p>
      <p className="text-muted-foreground mb-1 text-xs">{data.categoryName}</p>
      <p className="text-sm">Ingresos: {formatFullCurrency(data.revenue)}</p>
      <p className="text-muted-foreground text-sm">
        {new Intl.NumberFormat('es-AR').format(data.units)} unidades
      </p>
    </div>
  );
}

export function TopArticlesChart({ data }: TopArticlesChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('revenue');

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Artículos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-[300px] items-center justify-center">
            No hay datos disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: item.code,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Top 10 Artículos</CardTitle>
          <div className="flex gap-1">
            <Badge
              variant={viewMode === 'revenue' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setViewMode('revenue')}
            >
              Ingresos
            </Badge>
            <Badge
              variant={viewMode === 'units' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setViewMode('units')}
            >
              Unidades
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 10, left: 50, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              type="number"
              tickFormatter={viewMode === 'revenue' ? formatCurrency : (v) => `${v}`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              stroke="#475569"
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              stroke="#475569"
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={viewMode} fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
