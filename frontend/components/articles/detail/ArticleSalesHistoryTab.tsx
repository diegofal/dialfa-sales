'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROUTES } from '@/lib/constants/routes';

interface SalesHistoryRow {
  invoiceItemId: number;
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  clientId: number | null;
  clientName: string;
  quantity: number;
  unitPriceUsd: number;
  unitPriceArs: number;
  discountPercent: number;
  lineTotal: number;
}

interface SalesHistoryResponse {
  data: SalesHistoryRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  totals: { units: number; revenueArs: number };
}

const RANGES: Record<string, { label: string; months?: number }> = {
  '1': { label: 'Último mes', months: 1 },
  '3': { label: 'Últimos 3 meses', months: 3 },
  '6': { label: 'Últimos 6 meses', months: 6 },
  '12': { label: 'Últimos 12 meses', months: 12 },
  '0': { label: 'Todo el historial' },
};

const formatArs = (n: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);

const formatNum = (n: number): string => new Intl.NumberFormat('es-AR').format(n);

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(iso)
  );

interface Props {
  articleId: number;
}

export function ArticleSalesHistoryTab({ articleId }: Props) {
  const [rangeKey, setRangeKey] = useState('12');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const range = RANGES[rangeKey];
  const from = range.months
    ? new Date(Date.now() - range.months * 30 * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const { data, isLoading, isError } = useQuery<SalesHistoryResponse>({
    queryKey: ['article', articleId, 'sales-history', { page, limit, rangeKey }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (from) params.set('from', from);
      const response = await axios.get(`/api/articles/${articleId}/sales-history?${params}`);
      return response.data;
    },
    enabled: articleId > 0,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Historial de ventas
            </CardTitle>
            <CardDescription>Facturas donde se vendió este artículo</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {data && (
              <div className="text-muted-foreground text-xs">
                <span className="text-foreground font-medium">
                  {formatNum(data.totals.units)} u
                </span>
                {' · '}
                <span className="text-foreground font-medium">
                  {formatArs(data.totals.revenueArs)}
                </span>
                {' en el rango'}
              </div>
            )}
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
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-muted/40 h-9 w-full animate-pulse rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No se pudo cargar el historial.
          </p>
        ) : !data || data.data.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Sin facturas en el rango seleccionado.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-card text-muted-foreground sticky top-0 text-xs uppercase">
                  <tr className="border-b">
                    <th className="pb-2 text-left">Fecha</th>
                    <th className="pb-2 text-left">Factura</th>
                    <th className="pb-2 text-left">Cliente</th>
                    <th className="pb-2 text-right">Cant.</th>
                    <th className="pb-2 text-right">Precio (ARS)</th>
                    <th className="pb-2 text-right">Desc.</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row) => (
                    <tr
                      key={row.invoiceItemId}
                      className="border-border/30 hover:bg-accent/40 border-b"
                    >
                      <td className="py-2">{formatDate(row.invoiceDate)}</td>
                      <td className="py-2 font-mono text-xs">
                        <Link
                          href={`${ROUTES.INVOICES}/${row.invoiceId}`}
                          className="text-primary hover:underline"
                        >
                          {row.invoiceNumber}
                        </Link>
                      </td>
                      <td className="max-w-[280px] truncate py-2">{row.clientName}</td>
                      <td className="py-2 text-right tabular-nums">{formatNum(row.quantity)}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatArs(row.unitPriceArs)}
                      </td>
                      <td className="text-muted-foreground py-2 text-right tabular-nums">
                        {row.discountPercent > 0 ? `${row.discountPercent.toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {formatArs(row.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Pagination
                totalCount={data.pagination.total}
                currentPage={data.pagination.page}
                pageSize={data.pagination.limit}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setLimit(s);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
