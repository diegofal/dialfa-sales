/**
 * Compact, reusable cell for showing the invoices an entity (e.g. an article)
 * appears in. Mirrors the inline pattern used across the app:
 *   - 0 invoices  → em dash
 *   - 1 invoice   → direct link to the invoice detail
 *   - 2+ invoices → count trigger that opens a popover with the full list
 *
 * Reused by TopArticlesSold, DeadStockMovementsReport and the Articles table.
 */

'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ROUTES } from '@/lib/constants/routes';

export interface InvoiceLink {
  id: number | string;
  number: string;
  date: string; // ISO date
}

const formatShortDate = (iso: string): string =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(iso));

interface InvoicesCellProps {
  invoices: InvoiceLink[];
  /** Header shown inside the popover when there are 2+ invoices. */
  label?: string;
}

export function InvoicesCell({ invoices, label = 'Facturas' }: InvoicesCellProps) {
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
        <p className="text-muted-foreground mb-2 px-2 text-xs uppercase">{label}</p>
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
