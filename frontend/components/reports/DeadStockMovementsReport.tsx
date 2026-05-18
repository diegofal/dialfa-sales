'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  ArrowRight,
  DollarSign,
  ExternalLink,
  FileText,
  LogOut,
  Pause,
  Package,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StockStatusBadge } from '@/components/articles/StockStatusBadge';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROUTES } from '@/lib/constants/routes';
import type {
  DeadStockMovementInvoice,
  DeadStockMovementsResult,
} from '@/lib/services/ReportsService';
import { StockStatus } from '@/types/stockValuation';

const RANGES: Record<string, { label: string; months: number }> = {
  '1': { label: 'Último mes', months: 1 },
  '3': { label: 'Últimos 3 meses', months: 3 },
  '6': { label: 'Últimos 6 meses', months: 6 },
  '12': { label: 'Últimos 12 meses', months: 12 },
};

const formatArs = (n: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const formatNum = (n: number): string => new Intl.NumberFormat('es-AR').format(n);

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(iso)
  );

const formatShortDate = (iso: string): string =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(iso));

function computeRange(rangeKey: string, custom: { from: string; to: string }) {
  if (rangeKey === 'custom') {
    if (!custom.from || !custom.to) return null;
    return { from: new Date(custom.from), to: new Date(custom.to) };
  }
  const cfg = RANGES[rangeKey];
  if (!cfg) return null;
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - cfg.months);
  return { from, to };
}

function InvoicesCell({ invoices }: { invoices: DeadStockMovementInvoice[] }) {
  if (invoices.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (invoices.length === 1) {
    const inv = invoices[0];
    return (
      <Link
        href={`${ROUTES.INVOICES}/${inv.id}`}
        className="text-primary inline-flex items-center gap-1 font-mono text-xs hover:underline"
        title={`Ver factura ${inv.number}`}
      >
        <FileText className="h-3 w-3" />
        {inv.number}
      </Link>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
        >
          <FileText className="h-3 w-3" />
          {invoices.length} facturas
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[320px] w-64 overflow-y-auto p-2">
        <p className="text-muted-foreground mb-2 px-2 text-xs uppercase">Facturas del período</p>
        <ul className="space-y-1">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`${ROUTES.INVOICES}/${inv.id}`}
                className="hover:bg-accent flex items-center justify-between rounded-md px-2 py-1.5 text-xs"
              >
                <span className="font-mono">{inv.number}</span>
                <span className="text-muted-foreground">{formatShortDate(inv.date)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

const PAGE_SIZE_DEFAULT = 25;

export function DeadStockMovementsReport() {
  const [rangeKey, setRangeKey] = useState('1');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

  const range = useMemo(() => computeRange(rangeKey, custom), [rangeKey, custom]);

  const { data, isLoading, isError, error } = useQuery<DeadStockMovementsResult>({
    queryKey: [
      'reports',
      'dead-stock-movements',
      range?.from.toISOString(),
      range?.to.toISOString(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('from', range!.from.toISOString());
      params.set('to', range!.to.toISOString());
      const response = await axios.get(`/api/reports/dead-stock-movements?${params}`);
      return response.data;
    },
    enabled: !!range,
  });

  const items = data?.items ?? [];
  const totalCount = items.length;
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Movimientos en Dead Stock</h1>
          <p className="text-muted-foreground text-sm">
            Artículos que estuvieron en stock muerto en algún momento del rango y tuvieron ventas en
            el período. El estado @ fin indica si salieron de la categoría.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={rangeKey}
            onValueChange={(v) => {
              setRangeKey(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RANGES).map(([k, r]) => (
                <SelectItem key={k} value={k}>
                  {r.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {rangeKey === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={custom.from}
                onChange={(e) => {
                  setCustom((c) => ({ ...c, from: e.target.value }));
                  setPage(1);
                }}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              />
              <span className="text-muted-foreground text-sm">→</span>
              <input
                type="date"
                value={custom.to}
                onChange={(e) => {
                  setCustom((c) => ({ ...c, to: e.target.value }));
                  setPage(1);
                }}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Salieron de Dead Stock"
          value={formatNum(data?.summary.exited ?? 0)}
          subtitle="Artículos que mejoraron de estado"
          icon={LogOut}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          loading={isLoading}
        />
        <MetricCard
          title="Siguen con Ventas"
          value={formatNum(data?.summary.stayedWithSales ?? 0)}
          subtitle="Aún dead pero tuvieron movimiento"
          icon={Pause}
          gradient="bg-gradient-to-br from-amber-500 to-amber-700"
          loading={isLoading}
        />
        <MetricCard
          title="Unidades Movidas"
          value={formatNum(data?.summary.units ?? 0)}
          subtitle="Total facturado en el rango"
          icon={Package}
          gradient="bg-gradient-to-br from-sky-500 to-sky-700"
          loading={isLoading}
        />
        <MetricCard
          title="Revenue ARS"
          value={formatArs(data?.summary.revenueArs ?? 0)}
          subtitle="Ventas en el rango"
          icon={DollarSign}
          gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
          loading={isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4" />
            Detalle de artículos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-muted/40 h-10 w-full animate-pulse rounded-md" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No se pudo cargar el reporte. {error instanceof Error ? error.message : ''}
            </p>
          ) : !range ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Seleccioná un rango de fechas válido.
            </p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              Sin movimientos de dead stock en el rango seleccionado.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-card text-muted-foreground sticky top-0 text-xs uppercase">
                    <tr className="border-b">
                      <th className="pb-2 text-left">Código</th>
                      <th className="pb-2 text-left">Descripción</th>
                      <th className="pb-2 text-left">Estado @ inicio</th>
                      <th className="pb-2 text-left">Estado @ fin</th>
                      <th className="pb-2 text-center">Δ</th>
                      <th className="pb-2 text-right">Vendido</th>
                      <th className="pb-2 text-right">Revenue</th>
                      <th className="pb-2 text-left">Última venta</th>
                      <th className="pb-2 text-left">Facturas</th>
                      <th className="pb-2 text-left">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedItems.map((item) => {
                      const exited = item.statusTo !== StockStatus.DEAD_STOCK;
                      return (
                        <tr
                          key={item.articleId}
                          className="border-border/30 hover:bg-accent/40 border-b"
                        >
                          <td className="py-2 font-mono text-xs">{item.code}</td>
                          <td className="max-w-[280px] truncate py-2" title={item.description}>
                            {item.description}
                          </td>
                          <td className="py-2">
                            <StockStatusBadge status={item.statusFrom} />
                          </td>
                          <td className="py-2">
                            <StockStatusBadge status={item.statusTo} />
                          </td>
                          <td className="py-2 text-center">
                            {exited ? (
                              <ArrowRight
                                className="inline h-4 w-4 text-emerald-500"
                                aria-label="Salió de dead stock"
                              />
                            ) : (
                              <Pause
                                className="text-muted-foreground inline h-4 w-4"
                                aria-label="Sigue en dead stock"
                              />
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatNum(item.unitsSold)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatArs(item.revenueArs)}
                          </td>
                          <td className="text-muted-foreground py-2 text-xs">
                            {item.lastSaleDate ? formatDate(item.lastSaleDate) : '—'}
                          </td>
                          <td className="py-2">
                            <InvoicesCell invoices={item.invoices} />
                          </td>
                          <td className="py-2">
                            <Link
                              href={`${ROUTES.ARTICLES}/${item.articleId}`}
                              className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                              title="Ver detalle del artículo"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <Pagination
                  totalCount={totalCount}
                  currentPage={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => {
                    setPageSize(s);
                    setPage(1);
                  }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
