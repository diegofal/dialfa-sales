'use client';

import { ArrowRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArticleTransition } from '@/types/stockTransitions';
import { StockStatusBadge } from './StockStatusBadge';

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  // Use UTC to avoid off-by-one when the server-side date is just a date string.
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR', { timeZone: 'UTC' });
}

interface TransitionsListProps {
  transitions: ArticleTransition[];
  emptyMessage?: string;
}

export function TransitionsList({ transitions, emptyMessage }: TransitionsListProps) {
  if (transitions.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border py-12 text-center">
        {emptyMessage ?? 'No hay transiciones que coincidan con los filtros.'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Cambio</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Vendido (período)</TableHead>
            <TableHead className="text-right">Movs.</TableHead>
            <TableHead className="text-right">Stock actual</TableHead>
            <TableHead className="text-right">Costo unit.</TableHead>
            <TableHead className="text-right">Valor stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transitions.map((t) => (
            <TableRow key={`${t.articleId}-${t.fromStatus}-${t.toStatus}`}>
              <TableCell className="font-mono text-xs">{t.articleCode}</TableCell>
              <TableCell className="max-w-[320px] truncate" title={t.description ?? undefined}>
                {t.description ?? '—'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <StockStatusBadge status={t.fromStatus} />
                  <ArrowRight className="text-muted-foreground h-3 w-3" />
                  <StockStatusBadge status={t.toStatus} />
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDate(t.transitionDate)}
              </TableCell>
              <TableCell
                className="text-right font-medium tabular-nums"
                title={t.unitsIn > 0 ? `+${numberFormatter.format(t.unitsIn)} entradas` : undefined}
              >
                <span className={t.unitsOut > 0 ? '' : 'text-muted-foreground'}>
                  {numberFormatter.format(t.unitsOut)}
                </span>
                {t.unitsIn > 0 && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    (+{numberFormatter.format(t.unitsIn)})
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {t.movementCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {numberFormatter.format(t.currentStock)}
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {currencyFormatter.format(t.unitValue)}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {currencyFormatter.format(t.stockValue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
