'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesByCategory } from '@/types/salesAnalytics';

interface CategoryPieChartProps {
  data: SalesByCategory[];
}

const COLORS = [
  'hsl(210, 70%, 50%)',
  'hsl(150, 60%, 45%)',
  'hsl(40, 80%, 50%)',
  'hsl(0, 65%, 50%)',
  'hsl(270, 60%, 55%)',
  'hsl(180, 55%, 45%)',
  'hsl(330, 65%, 50%)',
  'hsl(60, 70%, 45%)',
  'hsl(200, 70%, 55%)',
  'hsl(120, 50%, 40%)',
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface ChartDataItem {
  categoryName: string;
  revenue: number;
  percentage: number;
  categoryId: number;
}

interface TooltipPayloadItem {
  payload: ChartDataItem & { fill: string };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <p className="mb-1 font-semibold">{data.categoryName}</p>
      <p className="text-sm">{formatCurrency(data.revenue)}</p>
      <p className="text-muted-foreground text-sm">{data.percentage.toFixed(1)}%</p>
    </div>
  );
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ventas por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-[300px] items-center justify-center">
            No hay datos disponibles
          </div>
        </CardContent>
      </Card>
    );
  }

  // Map to plain objects with index signature for Recharts compatibility
  const chartData = data.map((item) => ({
    categoryName: item.categoryName,
    revenue: item.revenue,
    percentage: item.percentage,
    categoryId: item.categoryId,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ventas por Categoría</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="revenue"
              nameKey="categoryName"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value: string) => (
                <span className="text-foreground text-xs">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
