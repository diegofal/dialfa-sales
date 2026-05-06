/**
 * Sales Trend Chart (12 months)
 * Reads from /api/dashboard/charts (xERP MonthlySalesTrend).
 */

'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatCurrency,
  useDashboardCharts,
  type MonthlySalesTrend,
} from '@/lib/hooks/domain/useDashboard';

interface ChartDatum {
  label: string;
  revenue: number;
  invoices: number;
  customers: number;
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

function transformData(rows: MonthlySalesTrend[]): ChartDatum[] {
  return rows
    .slice()
    .sort((a, b) => (a.Year - b.Year) * 100 + (a.Month - b.Month))
    .map((row) => ({
      label: `${SHORT_MONTHS[row.Month - 1]} ${String(row.Year).slice(-2)}`,
      revenue: Number(row.MonthlyRevenue) || 0,
      invoices: Number(row.InvoiceCount) || 0,
      customers: Number(row.UniqueCustomers) || 0,
    }));
}

const formatAxisCurrency = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

interface TooltipPayloadItem {
  payload: ChartDatum;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-3 shadow-md">
      <p className="mb-1 font-semibold">{data.label}</p>
      <p className="text-sm">Facturado: {formatCurrency(data.revenue)}</p>
      <p className="text-muted-foreground text-sm">{data.invoices} facturas</p>
      <p className="text-muted-foreground text-sm">{data.customers} clientes únicos</p>
    </div>
  );
}

export function SalesTrendChart() {
  const { data, isLoading, isError } = useDashboardCharts(12);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tendencia de Facturación</CardTitle>
        <CardDescription>Últimos 12 meses (ARS con IVA)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="bg-muted/40 h-[280px] w-full animate-pulse rounded-md" />
        ) : isError ? (
          <div className="text-muted-foreground flex h-[280px] items-center justify-center text-sm">
            Error al cargar la tendencia
          </div>
        ) : data?.error ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-1 px-4 text-center text-sm">
            <span className="font-medium text-amber-500">No se pudo cargar</span>
            <span className="text-muted-foreground text-xs">{data.error}</span>
          </div>
        ) : !data?.salesTrend?.length ? (
          <div className="text-muted-foreground flex h-[280px] items-center justify-center text-sm">
            No hay datos de facturación
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={transformData(data.salesTrend)}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="dashSalesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="#475569" />
              <YAxis
                tickFormatter={formatAxisCurrency}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                stroke="#475569"
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                fill="url(#dashSalesGradient)"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981' }}
                activeDot={{ r: 5, fill: '#10b981' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
