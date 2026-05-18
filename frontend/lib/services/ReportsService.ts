/**
 * ReportsService
 *
 * Reportes consolidados que combinan señales del clasificador
 * (`article_status_snapshots`) con la actividad facturada del período.
 *
 * El predicado canónico de facturas "movió" es el mismo que usa el
 * clasificador (ver `monthsWithSalesInLast12` en `stockValuation.ts`) y los
 * dashboards: `is_printed = true AND is_cancelled = false AND deleted_at IS NULL`.
 * Las facturas canceladas NUNCA cuentan como movimiento.
 */

import { prisma } from '@/lib/db';
import { StockStatus } from '@/types/stockValuation';

export interface DeadStockMovementInvoice {
  id: string;
  number: string;
  date: string; // ISO
}

export interface DeadStockMovementItem {
  articleId: string;
  code: string;
  description: string;
  categoryName: string | null;
  statusFrom: StockStatus;
  statusTo: StockStatus;
  unitsSold: number;
  revenueArs: number;
  lastSaleDate: string | null; // ISO
  invoices: DeadStockMovementInvoice[];
}

export interface DeadStockMovementsSummary {
  exited: number; // status@to !== DEAD_STOCK
  stayedWithSales: number; // status@to === DEAD_STOCK && units > 0
  units: number;
  revenueArs: number;
}

export interface DeadStockMovementsResult {
  from: string; // ISO
  to: string; // ISO
  summary: DeadStockMovementsSummary;
  items: DeadStockMovementItem[];
}

interface CandidateRow {
  article_id: string;
  article_code: string;
  description: string | null;
  category_name: string | null;
  status_from: string;
  status_to: string;
  units_sold: number;
  revenue_ars: string;
  last_sale_date: Date | null;
}

interface InvoiceRow {
  article_id: bigint;
  invoice_id: bigint;
  invoice_number: string;
  invoice_date: Date;
}

export async function getDeadStockMovements(params: {
  from: Date;
  to: Date;
}): Promise<DeadStockMovementsResult> {
  const { from, to } = params;

  // Una sola query que:
  //  - resuelve status@from y status@to usando el snapshot más reciente con date <= cada bound
  //  - filtra candidatos con status@from = 'dead_stock'
  //  - agrega ventas (sólo facturas impresas, no canceladas) del rango [from, to)
  //  - aplica el criterio (a) salió de dead OR (b) sigue pero tuvo ventas
  const candidates = await prisma.$queryRaw<CandidateRow[]>`
    WITH status_from AS (
      SELECT DISTINCT ON (article_id) article_id, article_code, status
      FROM article_status_snapshots
      WHERE date <= ${from}
      ORDER BY article_id, date DESC
    ),
    status_to AS (
      SELECT DISTINCT ON (article_id) article_id, status
      FROM article_status_snapshots
      WHERE date <= ${to}
      ORDER BY article_id, date DESC
    ),
    candidates AS (
      SELECT
        sf.article_id,
        sf.article_code,
        sf.status AS status_from,
        st.status AS status_to
      FROM status_from sf
      INNER JOIN status_to st ON sf.article_id = st.article_id
      WHERE sf.status = ${StockStatus.DEAD_STOCK}
    ),
    sales AS (
      SELECT
        ii.article_id,
        SUM(ii.quantity)::int AS units_sold,
        SUM(ii.line_total)::numeric AS revenue_ars,
        MAX(i.invoice_date) AS last_sale_date
      FROM invoice_items ii
      INNER JOIN invoices i ON ii.invoice_id = i.id
      INNER JOIN candidates c ON c.article_id = ii.article_id
      WHERE i.is_printed = true
        AND i.is_cancelled = false
        AND i.deleted_at IS NULL
        AND i.invoice_date >= ${from}
        AND i.invoice_date < ${to}
      GROUP BY ii.article_id
    )
    SELECT
      c.article_id::text AS article_id,
      c.article_code,
      a.description,
      cat.name AS category_name,
      c.status_from,
      c.status_to,
      COALESCE(s.units_sold, 0)::int AS units_sold,
      COALESCE(s.revenue_ars, 0)::text AS revenue_ars,
      s.last_sale_date
    FROM candidates c
    INNER JOIN sales s ON s.article_id = c.article_id
    LEFT JOIN articles a ON a.id = c.article_id
    LEFT JOIN categories cat ON cat.id = a.category_id
    WHERE s.units_sold > 0
    ORDER BY s.revenue_ars DESC, s.units_sold DESC
  `;

  if (candidates.length === 0) {
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      summary: { exited: 0, stayedWithSales: 0, units: 0, revenueArs: 0 },
      items: [],
    };
  }

  const articleIds = candidates.map((c) => BigInt(c.article_id));

  // Lista de facturas DISTINCT (por (article_id, invoice_id)) para el período,
  // usando el mismo predicado canónico. `$queryRawUnsafe` con parámetros
  // posicionales, alineado con el patrón en DashboardService para arrays bigint.
  // Sin casts en la proyección: con SELECT DISTINCT, las expresiones del
  // ORDER BY deben coincidir con el SELECT.
  const invoices = await prisma.$queryRawUnsafe<InvoiceRow[]>(
    `SELECT DISTINCT
      ii.article_id,
      i.id AS invoice_id,
      i.invoice_number,
      i.invoice_date
    FROM invoice_items ii
    INNER JOIN invoices i ON ii.invoice_id = i.id
    WHERE ii.article_id = ANY($1::bigint[])
      AND i.is_printed = true
      AND i.is_cancelled = false
      AND i.deleted_at IS NULL
      AND i.invoice_date >= $2
      AND i.invoice_date < $3
    ORDER BY ii.article_id, i.invoice_date DESC`,
    articleIds,
    from,
    to
  );

  const invoicesByArticle = new Map<string, DeadStockMovementInvoice[]>();
  for (const row of invoices) {
    const articleKey = row.article_id.toString();
    const list = invoicesByArticle.get(articleKey) ?? [];
    list.push({
      id: row.invoice_id.toString(),
      number: row.invoice_number,
      date: row.invoice_date.toISOString(),
    });
    invoicesByArticle.set(articleKey, list);
  }

  const items: DeadStockMovementItem[] = candidates.map((c) => ({
    articleId: c.article_id,
    code: c.article_code,
    description: c.description ?? '—',
    categoryName: c.category_name,
    statusFrom: c.status_from as StockStatus,
    statusTo: c.status_to as StockStatus,
    unitsSold: c.units_sold,
    revenueArs: Number(c.revenue_ars),
    lastSaleDate: c.last_sale_date ? c.last_sale_date.toISOString() : null,
    invoices: invoicesByArticle.get(c.article_id) ?? [],
  }));

  const summary = items.reduce<DeadStockMovementsSummary>(
    (acc, item) => {
      if (item.statusTo !== StockStatus.DEAD_STOCK) acc.exited += 1;
      else if (item.unitsSold > 0) acc.stayedWithSales += 1;
      acc.units += item.unitsSold;
      acc.revenueArs += item.revenueArs;
      return acc;
    },
    { exited: 0, stayedWithSales: 0, units: 0, revenueArs: 0 }
  );

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    summary,
    items,
  };
}
