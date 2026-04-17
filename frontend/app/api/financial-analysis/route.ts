import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { prisma } from '@/lib/db';
import { handleError } from '@/lib/errors';

// Monthly invoicing (last 18 months, excluding current month)
const Q_MONTHLY = `
SELECT
  to_char(date_trunc('month', invoice_date), 'YYYY-MM') AS mes,
  COUNT(*)::int AS facturas,
  COUNT(DISTINCT i.sales_order_id)::int AS ordenes,
  SUM(CASE WHEN substring(invoice_number, 1, 4) = 'INV-'
           THEN net_amount   / NULLIF(usd_exchange_rate, 0)
           ELSE net_amount   END)::float AS net_usd,
  SUM(CASE WHEN substring(invoice_number, 1, 4) = 'INV-'
           THEN total_amount / NULLIF(usd_exchange_rate, 0)
           ELSE total_amount END)::float AS total_usd
FROM invoices i
WHERE deleted_at IS NULL
  AND is_cancelled = false
  AND is_quotation = false
  AND is_credit_note = false
  AND invoice_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '18 months')
  AND invoice_date <  date_trunc('month', CURRENT_DATE)
GROUP BY 1
ORDER BY 1;
`;

// Monthly collections (payments) with exchange rate from invoices
const Q_MONTHLY_COLLECTIONS = `
WITH monthly_rate AS (
  SELECT to_char(date_trunc('month', invoice_date), 'YYYY-MM') AS mes,
         AVG(usd_exchange_rate) FILTER (WHERE usd_exchange_rate > 0) AS avg_rate
  FROM invoices
  WHERE deleted_at IS NULL
    AND usd_exchange_rate > 0
    AND invoice_date >= '2023-01-01'
  GROUP BY 1
)
SELECT
  to_char(date_trunc('month', st.payment_date), 'YYYY-MM') AS mes,
  COUNT(*)::int AS n,
  SUM(st.payment_amount)::float AS total_ars,
  (SUM(st.payment_amount) / COALESCE(NULLIF(mr.avg_rate, 0), 1400))::float AS total_usd,
  COALESCE(NULLIF(mr.avg_rate, 0), 1400)::float AS avg_rate,
  COUNT(DISTINCT st.customer_id)::int AS clientes
FROM sync_transactions st
LEFT JOIN monthly_rate mr
  ON mr.mes = to_char(date_trunc('month', st.payment_date), 'YYYY-MM')
WHERE st.payment_date IS NOT NULL
  AND st.payment_amount > 0
  AND st.payment_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '18 months')
  AND st.payment_date <  date_trunc('month', CURRENT_DATE)
GROUP BY 1, mr.avg_rate
ORDER BY 1;
`;

// CMV cost anchors — latest proforma FOB vs invoice sales
const Q_COST_ANCHORS = `
WITH latest_proforma AS (
  SELECT DISTINCT ON (soi.article_id)
    soi.article_id,
    soi.proforma_unit_price AS fob_usd
  FROM supplier_order_items soi
  JOIN supplier_orders so ON so.id = soi.supplier_order_id
  WHERE soi.proforma_unit_price > 0
    AND so.deleted_at IS NULL
  ORDER BY soi.article_id, so.order_date DESC
),
invoice_lines AS (
  SELECT
    ii.article_id,
    ii.quantity,
    CASE WHEN substring(i.invoice_number, 1, 4) = 'INV-'
         THEN ii.line_total / NULLIF(i.usd_exchange_rate, 0)
         ELSE ii.line_total END AS line_usd
  FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE i.deleted_at IS NULL
    AND i.is_cancelled = false
    AND i.is_quotation = false
    AND i.is_credit_note = false
    AND i.invoice_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '18 months')
)
SELECT
  COUNT(DISTINCT il.article_id)::int                                                  AS articulos_facturados,
  COUNT(DISTINCT CASE WHEN lp.fob_usd IS NOT NULL THEN il.article_id END)::int        AS articulos_con_costo,
  COALESCE(SUM(il.line_usd), 0)::float                                                AS venta_total_usd,
  COALESCE(SUM(CASE WHEN lp.fob_usd IS NOT NULL THEN il.line_usd ELSE 0 END), 0)::float AS venta_cubierta_usd,
  COALESCE(SUM(CASE WHEN lp.fob_usd IS NOT NULL THEN il.quantity * lp.fob_usd ELSE 0 END), 0)::float AS fob_total_cubierto_usd,
  (SELECT COUNT(*)::int FROM supplier_orders WHERE deleted_at IS NULL)                 AS proformas_cargadas
FROM invoice_lines il
LEFT JOIN latest_proforma lp ON lp.article_id = il.article_id;
`;

// Top 20 clients by net sales (last 12 months)
const Q_TOP_CLIENTS = `
WITH inv AS (
  SELECT i.id, i.invoice_date, i.invoice_number,
         CASE WHEN substring(i.invoice_number, 1, 4) = 'INV-'
              THEN i.net_amount / NULLIF(i.usd_exchange_rate, 0)
              ELSE i.net_amount END AS net_usd,
         so.client_id
  FROM invoices i
  LEFT JOIN sales_orders so ON so.id = i.sales_order_id
  WHERE i.deleted_at IS NULL
    AND i.is_cancelled = false AND i.is_quotation = false AND i.is_credit_note = false
    AND i.invoice_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '12 months')
)
SELECT
  COALESCE(c.business_name, '(sin cliente)') AS cliente,
  COUNT(inv.id)::int AS facturas,
  COALESCE(SUM(inv.net_usd), 0)::float AS net_usd
FROM inv
LEFT JOIN clients c ON c.id = inv.client_id
GROUP BY 1
ORDER BY net_usd DESC NULLS LAST
LIMIT 20;
`;

// Top 20 products by sales (last 12 months)
const Q_TOP_PRODUCTS = `
WITH line AS (
  SELECT ii.article_id, ii.article_code, ii.article_description,
         ii.quantity, ii.line_total,
         i.invoice_number, i.usd_exchange_rate
  FROM invoice_items ii
  JOIN invoices i ON i.id = ii.invoice_id
  WHERE i.deleted_at IS NULL
    AND i.is_cancelled = false AND i.is_quotation = false AND i.is_credit_note = false
    AND i.invoice_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '12 months')
)
SELECT
  article_code AS code,
  MAX(article_description) AS descripcion,
  SUM(quantity)::float AS unidades,
  COALESCE(SUM(CASE WHEN substring(invoice_number, 1, 4) = 'INV-'
           THEN line_total / NULLIF(usd_exchange_rate, 0)
           ELSE line_total END), 0)::float AS facturado_usd
FROM line
GROUP BY article_code
ORDER BY facturado_usd DESC NULLS LAST
LIMIT 20;
`;

interface RawRow {
  [key: string]: unknown;
}

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const [monthly, collections, costStatsRows, topClients, topProducts] = await Promise.all([
      prisma.$queryRawUnsafe<RawRow[]>(Q_MONTHLY),
      prisma.$queryRawUnsafe<RawRow[]>(Q_MONTHLY_COLLECTIONS),
      prisma.$queryRawUnsafe<RawRow[]>(Q_COST_ANCHORS),
      prisma.$queryRawUnsafe<RawRow[]>(Q_TOP_CLIENTS),
      prisma.$queryRawUnsafe<RawRow[]>(Q_TOP_PRODUCTS),
    ]);

    return NextResponse.json({
      monthly,
      collections,
      topClients,
      topProducts,
      costStats: costStatsRows[0] || {
        articulos_facturados: 0,
        articulos_con_costo: 0,
        venta_total_usd: 0,
        venta_cubierta_usd: 0,
        fob_total_cubierto_usd: 0,
        proformas_cargadas: 0,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
