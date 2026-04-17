"""
build_variable_pay_simulator.py

Genera un HTML autocontenido (Chart.js via CDN) con un simulador de compensacion
variable para DIALFA, alimentado con datos REALES de la base de produccion.

Modo v3.1: comparativa ACTUAL vs PROPUESTA con perfiles de nomina editables.

Datos del backend:
  - Facturacion mensual (USD) de los ultimos 18 meses (mes corriente excluido).
  - Top 20 clientes (ultimos 12 meses).
  - Top 20 articulos vendidos (ultimos 12 meses).
  - Concentracion de clientes (Top-1, Top-5, Top-10).

El CMV se modela como parametro (slider) con 3 anclas empiricas calculadas a
partir de dos pedidos reales de importacion (PO-000016 y PO-000017):

    Venta c/desc total  : 539.421 USD
    FOB total           : 127.977 USD  ->  CMV ~ 23.7 %
    CIF total (x1.5)    : 191.966 USD  ->  CMV ~ 35.6 %
    Landed estimado x1.8: 230.360 USD  ->  CMV ~ 42.7 %

Uso:
    python scripts/build_variable_pay_simulator.py
"""
import os
import json
import sys
from decimal import Decimal
from datetime import date, datetime
from pathlib import Path

import psycopg2
import psycopg2.extras

# -------------------------------------------------------------------
# Configuracion
# -------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

HTML_OUT = OUTPUT_DIR / "dialfa_variable_pay_simulator_v3.html"
JSON_OUT = OUTPUT_DIR / "comp_variable_data.json"

ENV_PATH = SCRIPT_DIR.parent / ".env"
DATABASE_URL = None
if ENV_PATH.exists():
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL") and not line.startswith("#"):
            DATABASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
            break
if not DATABASE_URL:
    DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: no encontre DATABASE_URL en frontend/.env ni en entorno")
    sys.exit(1)

# Perfiles por default (actual confirmado por SALARIOS.xlsx ago2025 -> mar2026)
# Cada perfil tiene "rows": lista dinamica de roles/personas.
# Cada row: {name, count, salary, participates}
#   - participates: bool - si True, la persona recibe una parte igual del pool variable.
# Todos los que participan cobran lo mismo (distribucion equitativa).
DEFAULT_PROFILES = {
    "actual": {
        "label": "Actual",
        "rows": [
            {"name": "Junior", "count": 1, "salary": 1000, "participates": False},
            {"name": "Mid",    "count": 2, "salary": 1500, "participates": True},
            {"name": "Top",    "count": 2, "salary": 2000, "participates": True},
        ],
        "aguinaldo_meses": 1.0,
        "pays_variable": False,
    },
    "propuesta": {
        "label": "Propuesta",
        "rows": [
            {"name": "Rodri",       "count": 1, "salary": 1100, "participates": False},
            {"name": "Charly",      "count": 1, "salary": 1750, "participates": True},
            {"name": "Claudito",    "count": 1, "salary": 2000, "participates": True},
            {"name": "Dani y Pela", "count": 2, "salary": 2500, "participates": True},
        ],
        "aguinaldo_meses": 1.0,
        "pays_variable": True,
    },
}

# Costos operativos empresa (no incluyen sueldos).
# Defaults calibrados con el extracto bancario Credicoop Ene-Mar 2026 (normalizados).
DEFAULT_COMPANY_COSTS = {
    "fixed_usd_month":    12800,  # ARCA recurrente + servicios + mantenimiento + tasas (~18M ARS / 1400)
    "variable_pct_sales": 8.0,    # impuestos s/actividad + cheques + comisiones + distribucion (% sobre venta neta)
    "payroll_tax_pct":    40,     # aportes patronales + ART + SAC + vacaciones + seguro obligatorio
    "owner_draw_usd":     15800,  # retiros del socio/dueño (~22.2M ARS / 1400, desde Excel Credicoop)
}

# Referencia empirica del extracto bancario (Ene-Mar 2026 normalizados, en USD).
# Se muestra en la UI como comparacion contra los valores que cargue el usuario.
EXCEL_REFERENCE = {
    "source":              "Banco Credicoop Ene-Mar 2026 (extracto normalizado)",
    "fixed_usd_month":     12800,
    "variable_pct_sales":  8.0,
    "owner_draw_usd":      15800,
    "cash_margin_pct":     0.2,   # margen de caja real observado (ingresos - egresos totales)
    "notes": [
        "Ene-26 excluye $83.4M ARCA (nacionalizacion extraordinaria) y $94.5M venta de divisas",
        "Sueldos 'a banco' $9.1M/mes; resto se paga en efectivo -> no completo",
        "Pagos a proveedores excluidos de variables (serian doble-contado con CMV)",
    ],
}

# Configuracion del esquema variable
DEFAULT_VARIABLE_CONFIG = {
    "frequency":       "trimestral",   # mensual / trimestral / semestral / anual
    "cap_pct_salary":  50,             # cap individual = cap_pct * sueldo_fijo_mensual
    "source":          "cobranza",     # facturacion / cobranza
}

def profile_total(p):
    return sum(r["count"] * r["salary"] for r in p["rows"])

def profile_participants(p):
    return sum(r["count"] for r in p["rows"] if r.get("participates"))

# Anclas CMV empiricas (prorrateadas, ponderadas por venta) de los 2 POs reales
PO_ANCHORS = {
    "venta_usd_total":   539_421.0,
    "fob_usd_total":     127_977.0,
    "cif_usd_total":     191_966.0,
    "landed_usd_total":  230_360.0,
    "po16": {"venta": 239_914.78, "fob": 50_389.45, "cif": 75_584.17, "margen_pct": 217.4},
    "po17": {"venta": 299_507.27, "fob": 77_588.35, "cif": 116_382.53, "margen_pct": 157.3},
}
PO_ANCHORS["cmv_fob_pct"]    = round(100 * PO_ANCHORS["fob_usd_total"]    / PO_ANCHORS["venta_usd_total"], 1)
PO_ANCHORS["cmv_cif_pct"]    = round(100 * PO_ANCHORS["cif_usd_total"]    / PO_ANCHORS["venta_usd_total"], 1)
PO_ANCHORS["cmv_landed_pct"] = round(100 * PO_ANCHORS["landed_usd_total"] / PO_ANCHORS["venta_usd_total"], 1)

# -------------------------------------------------------------------
# SQL
# -------------------------------------------------------------------
Q_MONTHLY_COLLECTIONS = """
WITH monthly_rate AS (
  -- Promedio TC por mes desde invoices (unica fuente de TC historico)
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
  COUNT(*) AS n,
  SUM(st.payment_amount) AS total_ars,
  -- Divide por el TC promedio del mes. Si no hay TC (meses sin invoices),
  -- se usa 1400 como fallback (el dolar congelado actual).
  SUM(st.payment_amount) / COALESCE(NULLIF(mr.avg_rate, 0), 1400) AS total_usd,
  COALESCE(NULLIF(mr.avg_rate, 0), 1400) AS avg_rate,
  COUNT(DISTINCT st.customer_id) AS clientes
FROM sync_transactions st
LEFT JOIN monthly_rate mr
  ON mr.mes = to_char(date_trunc('month', st.payment_date), 'YYYY-MM')
WHERE st.payment_date IS NOT NULL
  AND st.payment_amount > 0
  AND st.payment_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '18 months')
  AND st.payment_date <  date_trunc('month', CURRENT_DATE)
GROUP BY 1, mr.avg_rate
ORDER BY 1;
"""

Q_STOCK_VALUATION = """
-- Replica la clasificacion de SPISA (stockValuation.ts):
--   ACTIVE: vendido en ultimos 90 dias Y avg >= 5 uds/mes
--   SLOW_MOVING: vendido en ultimos 180 dias O bajo volumen
--   DEAD_STOCK: no vendido en 365+ dias
--   NEVER_SOLD: nunca vendido Y stock > 0
WITH last_sale AS (
  SELECT
    soi.article_id,
    MAX(i.invoice_date) AS last_sale_date,
    SUM(soi.quantity) AS total_qty_sold,
    GREATEST(1, EXTRACT(MONTH FROM AGE(NOW(), MIN(i.invoice_date)))) AS months_span
  FROM sales_order_items soi
  JOIN sales_orders so ON soi.sales_order_id = so.id
  JOIN invoices i ON i.sales_order_id = so.id
  WHERE i.is_cancelled = false AND i.deleted_at IS NULL AND so.deleted_at IS NULL
  GROUP BY soi.article_id
),
classified AS (
  SELECT
    a.id, a.code, a.stock, a.unit_price,
    COALESCE(NULLIF(a.last_purchase_price, 0), lp.fob_usd, 0) AS cost_usd,
    CASE
      WHEN ls.last_sale_date IS NULL THEN 'NEVER_SOLD'
      WHEN EXTRACT(DAY FROM (NOW() - ls.last_sale_date)) > 365 THEN 'DEAD_STOCK'
      WHEN EXTRACT(DAY FROM (NOW() - ls.last_sale_date)) <= 90
           AND (ls.total_qty_sold / ls.months_span) >= 5 THEN 'ACTIVE'
      ELSE 'SLOW_MOVING'
    END AS status
  FROM articles a
  LEFT JOIN last_sale ls ON ls.article_id = a.id
  LEFT JOIN (
    SELECT DISTINCT ON (soi2.article_id)
      soi2.article_id, soi2.proforma_unit_price AS fob_usd
    FROM supplier_order_items soi2
    JOIN supplier_orders so2 ON so2.id = soi2.supplier_order_id
    WHERE soi2.proforma_unit_price > 0 AND so2.deleted_at IS NULL
    ORDER BY soi2.article_id, so2.order_date DESC
  ) lp ON lp.article_id = a.id
  WHERE a.deleted_at IS NULL AND a.is_active = true AND a.stock > 0
)
SELECT
  status,
  COUNT(*) AS articulos,
  SUM(stock)::bigint AS unidades,
  SUM(stock * unit_price) AS valor_retail,
  SUM(stock * cost_usd) AS valor_costo,
  SUM(CASE WHEN cost_usd > 0 THEN stock * cost_usd ELSE 0 END) AS valor_costo_conocido,
  COUNT(*) FILTER (WHERE cost_usd > 0) AS articulos_con_costo
FROM classified
GROUP BY status
ORDER BY CASE status
  WHEN 'ACTIVE' THEN 1
  WHEN 'SLOW_MOVING' THEN 2
  WHEN 'DEAD_STOCK' THEN 3
  WHEN 'NEVER_SOLD' THEN 4
END;
"""

Q_COST_ANCHORS = """
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
  COUNT(DISTINCT il.article_id)                                                AS articulos_facturados,
  COUNT(DISTINCT CASE WHEN lp.fob_usd IS NOT NULL THEN il.article_id END)       AS articulos_con_costo,
  SUM(il.line_usd)                                                             AS venta_total_usd,
  SUM(CASE WHEN lp.fob_usd IS NOT NULL THEN il.line_usd ELSE 0 END)             AS venta_cubierta_usd,
  SUM(CASE WHEN lp.fob_usd IS NOT NULL THEN il.quantity * lp.fob_usd ELSE 0 END) AS fob_total_cubierto_usd,
  (SELECT COUNT(*) FROM supplier_orders WHERE deleted_at IS NULL)              AS proformas_cargadas
FROM invoice_lines il
LEFT JOIN latest_proforma lp ON lp.article_id = il.article_id;
"""

Q_MONTHLY = """
SELECT
  to_char(date_trunc('month', invoice_date), 'YYYY-MM') AS mes,
  COUNT(*) AS facturas,
  COUNT(DISTINCT i.sales_order_id) AS ordenes,
  SUM(CASE WHEN substring(invoice_number, 1, 4) = 'INV-'
           THEN net_amount   / NULLIF(usd_exchange_rate, 0)
           ELSE net_amount   END) AS net_usd,
  SUM(CASE WHEN substring(invoice_number, 1, 4) = 'INV-'
           THEN total_amount / NULLIF(usd_exchange_rate, 0)
           ELSE total_amount END) AS total_usd
FROM invoices i
WHERE deleted_at IS NULL
  AND is_cancelled = false
  AND is_quotation = false
  AND is_credit_note = false
  AND invoice_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '18 months')
GROUP BY 1
ORDER BY 1;
"""

Q_TOP_CLIENTS = """
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
  COUNT(inv.id) AS facturas,
  SUM(inv.net_usd) AS net_usd
FROM inv
LEFT JOIN clients c ON c.id = inv.client_id
GROUP BY 1
ORDER BY net_usd DESC NULLS LAST
LIMIT 20;
"""

Q_TOP_PRODUCTS = """
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
  SUM(quantity) AS unidades,
  SUM(CASE WHEN substring(invoice_number, 1, 4) = 'INV-'
           THEN line_total / NULLIF(usd_exchange_rate, 0)
           ELSE line_total END) AS facturado_usd
FROM line
GROUP BY article_code
ORDER BY facturado_usd DESC NULLS LAST
LIMIT 20;
"""


def fetch_all():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute(Q_MONTHLY)
            monthly = [dict(r) for r in cur.fetchall()]
            cur.execute(Q_MONTHLY_COLLECTIONS)
            collections = [dict(r) for r in cur.fetchall()]
            cur.execute(Q_TOP_CLIENTS)
            top_clients = [dict(r) for r in cur.fetchall()]
            cur.execute(Q_TOP_PRODUCTS)
            top_products = [dict(r) for r in cur.fetchall()]
            cur.execute(Q_COST_ANCHORS)
            cost_stats = dict(cur.fetchone())
            cur.execute(Q_STOCK_VALUATION)
            stock_valuation = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    def cast(row):
        return {k: (float(v) if isinstance(v, Decimal) else v) for k, v in row.items()}

    return {
        "monthly":          [cast(r) for r in monthly],
        "collections":      [cast(r) for r in collections],
        "top_clients":      [cast(r) for r in top_clients],
        "top_products":     [cast(r) for r in top_products],
        "cost_stats":       cast(cost_stats),
        "stock_valuation":  [cast(r) for r in stock_valuation],
    }


def compute_anchors(cost_stats):
    """Calcula anclas CMV dinamicas desde el historico de venta real."""
    venta_cubierta = cost_stats.get("venta_cubierta_usd") or 0
    fob            = cost_stats.get("fob_total_cubierto_usd") or 0
    venta_total    = cost_stats.get("venta_total_usd") or 0

    cmv_fob_pct    = round(100 * fob / venta_cubierta, 1) if venta_cubierta else 0.0
    cmv_cif_pct    = round(cmv_fob_pct * 1.5, 1)
    cmv_landed_pct = round(cmv_fob_pct * 1.8, 1)

    cobertura_pct  = round(100 * venta_cubierta / venta_total, 1) if venta_total else 0.0
    calidad = ("alta" if cobertura_pct >= 60 else
               "media" if cobertura_pct >= 30 else
               "baja")

    return {
        "cmv_fob_pct":        cmv_fob_pct,
        "cmv_cif_pct":        cmv_cif_pct,
        "cmv_landed_pct":     cmv_landed_pct,
        "cobertura_pct":      cobertura_pct,
        "calidad":            calidad,
        "articulos_facturados": int(cost_stats.get("articulos_facturados") or 0),
        "articulos_con_costo":  int(cost_stats.get("articulos_con_costo") or 0),
        "proformas_cargadas":   int(cost_stats.get("proformas_cargadas") or 0),
        "venta_cubierta_usd":   round(venta_cubierta),
        "venta_total_usd":      round(venta_total),
        "fob_total_cubierto":   round(fob),
    }


def build_derived(raw):
    monthly = raw["monthly"]
    for r in monthly:
        r["net_usd"]   = r.get("net_usd") or 0.0
        r["total_usd"] = r.get("total_usd") or 0.0

    # Excluye el mes corriente (datos parciales)
    current_month = date.today().strftime("%Y-%m")
    monthly = [m for m in monthly if m["mes"] < current_month]

    # Merge cobranzas al array monthly
    collections_by_mes = {c["mes"]: c for c in raw.get("collections", [])}
    for m in monthly:
        coll = collections_by_mes.get(m["mes"], {})
        m["cobranza_usd"] = float(coll.get("total_usd") or 0)
        m["cobranza_ars"] = float(coll.get("total_ars") or 0)
        m["cobranza_rate"] = float(coll.get("avg_rate") or 0)
        m["cobranza_n"]    = int(coll.get("n") or 0)

    last12 = monthly[-12:] if len(monthly) >= 12 else monthly
    avg_net   = sum(m["net_usd"]   for m in last12) / max(len(last12), 1)
    avg_total = sum(m["total_usd"] for m in last12) / max(len(last12), 1)
    max_m = max(last12, key=lambda m: m["net_usd"]) if last12 else None
    min_m = min(last12, key=lambda m: m["net_usd"]) if last12 else None

    tail = monthly[-6:] if len(monthly) >= 6 else monthly
    if len(tail) == 6:
        prev_q = sum(m["net_usd"] for m in tail[:3]) / 3
        last_q = sum(m["net_usd"] for m in tail[3:]) / 3
        trend_pct = ((last_q / prev_q - 1) * 100) if prev_q else 0
    else:
        trend_pct = 0.0

    total_sales_12m = sum(m["net_usd"] for m in last12)
    top1  = raw["top_clients"][0]["net_usd"] if raw["top_clients"] else 0
    top5  = sum(c["net_usd"] for c in raw["top_clients"][:5])  if raw["top_clients"] else 0
    top10 = sum(c["net_usd"] for c in raw["top_clients"][:10]) if raw["top_clients"] else 0

    def pct(part): return round(100 * part / total_sales_12m, 1) if total_sales_12m else 0

    return {
        "monthly": monthly,
        "top_clients": raw["top_clients"],
        "top_products": raw["top_products"],
        "summary": {
            "months_count":     len(monthly),
            "avg_net_12m":      round(avg_net),
            "avg_total_12m":    round(avg_total),
            "max_month":        {"mes": max_m["mes"], "usd": round(max_m["net_usd"])} if max_m else None,
            "min_month":        {"mes": min_m["mes"], "usd": round(min_m["net_usd"])} if min_m else None,
            "trend_pct":        round(trend_pct, 1),
            "total_sales_12m":  round(total_sales_12m),
            "top1_pct":         pct(top1),
            "top5_pct":         pct(top5),
            "top10_pct":        pct(top10),
        },
        "po_anchors": PO_ANCHORS,
        "cost_anchors": compute_anchors(raw.get("cost_stats", {})),
        "stock_valuation": raw.get("stock_valuation", []),
        "default_profiles": DEFAULT_PROFILES,
        "default_company_costs": DEFAULT_COMPANY_COSTS,
        "default_variable_config": DEFAULT_VARIABLE_CONFIG,
        "excel_reference": EXCEL_REFERENCE,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
    }


# -------------------------------------------------------------------
# Template HTML
# -------------------------------------------------------------------
HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DIALFA - Simulador de Compensacion Variable v3.1</title>
<style>
  :root {
    --bg: #0f172a; --card: #1e293b; --card2: #0b1220; --border: #334155;
    --text: #e2e8f0; --muted: #94a3b8; --accent: #3b82f6;
    --success: #10b981; --warn: #f59e0b; --danger: #ef4444;
  }
  @media (prefers-color-scheme: light) {
    :root { --bg:#f8fafc; --card:#ffffff; --card2:#f1f5f9; --border:#e2e8f0; --text:#0f172a; --muted:#64748b; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,Segoe UI,Roboto,sans-serif; padding:20px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
  .wrap { max-width: 1400px; margin: 0 auto; }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .kpi { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .kpi-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi-value { font-size: 22px; font-weight: 600; margin-top: 4px; }
  .kpi-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .kpi.highlight-act { border-left: 3px solid #64748b; }
  .kpi.highlight-prop { border-left: 3px solid var(--accent); }
  .kpi.highlight-delta { border-left: 3px solid var(--success); }

  .profiles { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }
  @media (max-width: 820px) { .profiles { grid-template-columns: 1fr; } }
  .profile-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .profile-card h3 { margin: 0 0 10px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .profile-card.actual h3::before   { content: "● "; color: #64748b; }
  .profile-card.propuesta h3::before { content: "● "; color: var(--accent); }
  .rows-header { display: grid; grid-template-columns: 1fr 50px 90px 60px 28px; gap: 6px; padding: 0 4px 4px; font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .rows-container { display: flex; flex-direction: column; gap: 5px; }
  .emp-row { display: grid; grid-template-columns: 1fr 50px 90px 60px 28px; gap: 6px; align-items: center; }
  .emp-row input[type=text],
  .emp-row input[type=number] {
    width: 100%; padding: 5px 7px; background: var(--card2); color: var(--text);
    border: 1px solid var(--border); border-radius: 5px; font-size: 12px; font-variant-numeric: tabular-nums;
  }
  .emp-row input:focus { outline: 1px solid var(--accent); }
  .emp-row .participates-cell { display: flex; align-items: center; justify-content: center; }
  .emp-row input[type=checkbox] { width: 16px; height: 16px; cursor: pointer; }
  .btn-remove-row { background: transparent; color: var(--muted); border: 1px solid var(--border); border-radius: 5px; padding: 3px 0; cursor: pointer; font-size: 14px; line-height: 1; }
  .btn-remove-row:hover { color: var(--danger); border-color: var(--danger); }
  .btn-add-row { margin-top: 8px; background: transparent; color: var(--accent); border: 1px dashed var(--accent); border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px; width: 100%; }
  .btn-add-row:hover { background: rgba(59,130,246,0.1); }
  .profile-footer { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; }
  .profile-footer .total { font-size: 16px; font-weight: 600; }
  .profile-footer .total small { color: var(--muted); font-weight: 400; font-size: 11px; margin-left: 6px; }
  .profile-meta { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; padding-top: 8px; margin-top: 8px; border-top: 1px dashed var(--border); font-size: 11px; }
  .profile-meta label { color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .profile-meta input[type=number] { width: 60px; padding: 4px 6px; background: var(--card2); color: var(--text); border: 1px solid var(--border); border-radius: 5px; font-size: 11px; }
  .chk-var { display: flex; align-items: center; gap: 6px; color: var(--muted); cursor: pointer; }
  .chk-var input { cursor: pointer; }
  .btn-reset { background: transparent; color: var(--muted); border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 11px; }
  .btn-reset:hover { color: var(--text); border-color: var(--text); }

  .company-costs { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
  .cost-row { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
  .cost-row label { font-size: 13px; color: var(--muted); min-width: 240px; }
  .cost-row input[type=number] {
    width: 130px; padding: 6px 10px; background: var(--card2); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-variant-numeric: tabular-nums;
  }
  .cost-row .hint { font-size: 11px; color: var(--muted); font-style: italic; }

  .ref-card { margin-top: 14px; padding: 12px 14px; background: var(--card2); border-left: 3px solid #a855f7; border-radius: 6px; font-size: 11px; }
  .ref-card-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #a855f7; margin-bottom: 8px; font-weight: 600; }
  .ref-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px 14px; }
  .ref-item { display: flex; flex-direction: column; gap: 2px; }
  .ref-item-label { color: var(--muted); font-size: 10px; }
  .ref-item-val { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .ref-item-diff { font-size: 10px; }
  .ref-item-diff.ok   { color: var(--success); }
  .ref-item-diff.warn { color: var(--warn); }
  .ref-item-diff.bad  { color: var(--danger); }
  .ref-notes { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border); color: var(--muted); font-size: 10px; }
  .ref-notes ul { margin: 4px 0 0 14px; padding: 0; }
  .ref-notes li { margin: 2px 0; }

  .unit-economics { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
  .ue-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px 20px; }
  .ue-card { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; background: var(--card2); border-radius: 8px; border-left: 3px solid var(--border); }
  .ue-card.ok   { border-left-color: var(--success); }
  .ue-card.warn { border-left-color: var(--warn); }
  .ue-card.bad  { border-left-color: var(--danger); }
  .ue-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
  .ue-value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .ue-value.pos { color: var(--success); }
  .ue-value.neg { color: var(--danger); }
  .ue-sub   { font-size: 11px; color: var(--muted); }
  .ue-footer { margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border); font-size: 11px; color: var(--muted); line-height: 1.5; }
  .ue-footer code { background: rgba(148,163,184,0.15); padding: 1px 5px; border-radius: 3px; font-size: 10px; }

  .inventory-block { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; }
  .inv-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 14px; }
  .inv-card { padding: 12px 14px; background: var(--card2); border-radius: 8px; border-left: 3px solid var(--border); }
  .inv-card.active    { border-left-color: var(--success); }
  .inv-card.slow      { border-left-color: var(--warn); }
  .inv-card.dead      { border-left-color: var(--danger); }
  .inv-card.never     { border-left-color: #64748b; }
  .inv-card-title { font-size: 12px; font-weight: 600; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
  .inv-card-title .count { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .inv-card.active .count { background: rgba(16,185,129,0.2); color: var(--success); }
  .inv-card.slow   .count { background: rgba(245,158,11,0.2); color: var(--warn); }
  .inv-card.dead   .count { background: rgba(239,68,68,0.2); color: var(--danger); }
  .inv-card.never  .count { background: rgba(148,163,184,0.2); color: var(--muted); }
  .inv-metric { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; border-bottom: 1px solid var(--border); }
  .inv-metric:last-child { border-bottom: none; }
  .inv-metric .label { color: var(--muted); }
  .inv-metric .val { font-weight: 500; font-variant-numeric: tabular-nums; }
  .inv-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; padding-top: 14px; border-top: 1px dashed var(--border); }
  .inv-insight { padding: 12px; background: linear-gradient(135deg, rgba(168,85,247,0.08), rgba(16,185,129,0.06)); border: 1px solid rgba(168,85,247,0.3); border-radius: 8px; font-size: 12px; line-height: 1.5; }
  .inv-insight b { color: var(--text); }
  .inv-insight .hl { color: var(--success); font-weight: 600; }
  .inv-insight .neg { color: var(--danger); font-weight: 600; }

  .totalizer-banner { background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(16,185,129,0.12)); border: 1px solid #a855f7; border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
  .totalizer-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); margin-bottom: 8px; }
  .totalizer-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  @media (max-width: 700px) { .totalizer-grid { grid-template-columns: 1fr; } }
  .totalizer-col { display: flex; flex-direction: column; gap: 2px; }
  .totalizer-col .label { font-size: 11px; color: var(--muted); }
  .totalizer-col .value { font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .totalizer-col .sub   { font-size: 11px; color: var(--muted); }
  .totalizer-col.pos .value { color: var(--success); }
  .totalizer-col.neg .value { color: var(--danger); }

  .controls { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 20px; }
  .control-row { display: flex; align-items: center; gap: 12px; margin: 10px 0; }
  .control-row label { font-size: 13px; color: var(--muted); min-width: 200px; }
  .control-row input[type=range] { flex: 1; }
  .control-row .val { font-size: 14px; font-weight: 600; min-width: 70px; text-align: right; }
  .anchors { display: flex; gap: 8px; margin-top: 6px; font-size: 11px; flex-wrap: wrap; align-items: center; }
  .anchor { background: rgba(59,130,246,0.12); border: 1px solid var(--accent); color: var(--accent); padding: 3px 8px; border-radius: 6px; cursor: pointer; }
  .anchor:hover { background: rgba(59,130,246,0.25); }

  .data-quality { margin: 14px 0 4px; padding: 12px 14px; background: var(--card2); border-left: 3px solid var(--border); border-radius: 6px; font-size: 11px; }
  .dq-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .dq-badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .dq-badge.dq-alta  { background: rgba(16,185,129,0.2); color: var(--success); border: 1px solid var(--success); }
  .dq-badge.dq-media { background: rgba(245,158,11,0.2); color: var(--warn);    border: 1px solid var(--warn); }
  .dq-badge.dq-baja  { background: rgba(239,68,68,0.2);  color: var(--danger);  border: 1px solid var(--danger); }
  .data-quality.dq-alta  { border-left-color: var(--success); }
  .data-quality.dq-media { border-left-color: var(--warn); }
  .data-quality.dq-baja  { border-left-color: var(--danger); }
  .dq-meta { color: var(--muted); }
  .dq-meta b { color: var(--text); }
  .dq-detail { color: var(--muted); margin-top: 8px; line-height: 1.5; }
  .dq-detail code { background: rgba(148,163,184,0.15); padding: 1px 5px; border-radius: 3px; font-size: 10px; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
  .chart-wrap { position: relative; height: 280px; }

  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 500; font-size: 10px; text-transform: uppercase; position: sticky; top: 0; background: var(--card); }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.delta-pos { color: var(--success); }
  td.delta-neg { color: var(--danger); }
  tr.ex-pos { background: rgba(16,185,129,0.08); }
  tr.over-cap-prop { background: rgba(239,68,68,0.12); }

  .tag { display:inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .tag.green { background: rgba(16,185,129,0.2); color: var(--success); }
  .tag.red { background: rgba(239,68,68,0.2); color: var(--danger); }
  .tag.warn { background: rgba(245,158,11,0.2); color: var(--warn); }
  .tag.muted { background: rgba(148,163,184,0.2); color: var(--muted); }
  .recommendation { background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(16,185,129,0.12)); border: 1px solid var(--accent); border-radius: 10px; padding: 16px; margin: 20px 0; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; text-align: center; }
  .footnote { font-size: 11px; color: var(--muted); margin-top: 8px; }
  .scroll-x { overflow-x: auto; max-height: 420px; overflow-y: auto; }
  .delta-breakdown { font-size: 10px; color: var(--muted); white-space: nowrap; }
</style>
</head>
<body>
<div class="wrap">

  <h1>DIALFA - Simulador de Compensacion Variable</h1>
  <div class="sub">v3.1 · comparativa Actual vs Propuesta · datos reales ultimos 18 meses · generado <span id="gen-date"></span></div>

  <div class="kpis" id="kpis"></div>

  <h2>Unit economics global (el negocio cubre sus costos)</h2>
  <div class="unit-economics" id="unit-economics"></div>

  <h2>Perfiles de nomina (editables)</h2>
  <div class="profiles" id="profiles"></div>

  <h2 style="display:flex;align-items:center;gap:12px;">
    Costos operativos de la empresa (no incluyen sueldos)
    <button type="button" id="btn-reset-costs" class="btn-reset" style="margin-left:auto;text-transform:none;letter-spacing:0;font-weight:normal;">↺ Reset a valores del banco Credicoop</button>
  </h2>
  <div class="company-costs">
    <div class="cost-row">
      <label>Costos fijos mensuales (USD)</label>
      <input type="number" id="costo-fijo" min="0" step="100" value="12800">
      <span class="hint">alquiler, servicios, ARCA recurrente, mantenimiento, tasas, contador</span>
    </div>
    <div class="cost-row">
      <label>Costos variables (% sobre venta)</label>
      <input type="number" id="costo-var-pct" min="0" max="50" step="0.5" value="8">
      <span class="hint">IIBB, SIRCREB, Ley 25.413, cheques, comisiones bancarias, distribucion</span>
    </div>
    <div class="cost-row">
      <label>Retiro del socio / dueño (USD/mes)</label>
      <input type="number" id="owner-draw" min="0" step="100" value="15800">
      <span class="hint">sueldo Diego + tarjeta + educacion + inmobiliario + transferencias personales (se resta del margen operativo)</span>
    </div>
    <div class="cost-row">
      <label>Cargas sociales (% sobre nomina)</label>
      <input type="number" id="payroll-tax" min="0" max="100" step="1" value="40">
      <span class="hint">aportes patronales + ART + SAC provisionado + vacaciones + seguro obligatorio (~40% tipico AR)</span>
    </div>
  </div>

  <h2>Parametros del esquema variable</h2>
  <div class="controls">
    <div class="control-row">
      <label>Fuente de datos (base del calculo)</label>
      <select id="data-source" style="flex:1;padding:6px 10px;background:var(--card2);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:13px;">
        <option value="facturacion">Facturacion (invoice_items)</option>
        <option value="cobranza" selected>Cobranza (sync_transactions) - Recomendado</option>
      </select>
      <span class="val" style="min-width:auto;color:var(--muted);font-size:11px;" id="source-hint"></span>
    </div>
    <div class="control-row">
      <label>Frecuencia del pago variable</label>
      <select id="var-frequency" style="flex:1;padding:6px 10px;background:var(--card2);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:13px;">
        <option value="mensual">Mensual (1 mes)</option>
        <option value="trimestral" selected>Trimestral (3 meses) - Recomendado</option>
        <option value="semestral">Semestral (6 meses)</option>
        <option value="anual">Anual (12 meses)</option>
      </select>
    </div>
    <div class="control-row">
      <label>CMV (% sobre facturacion)</label>
      <input type="range" id="sl-cmv" min="10" max="60" step="0.5" value="32.4">
      <span class="val" id="out-cmv">32.4%</span>
    </div>
    <div class="anchors" id="anchors"></div>
    <div class="control-row" style="margin-top: 16px;">
      <label>% variable s/excedente (por participante)</label>
      <input type="range" id="sl-pct" min="1" max="30" step="0.25" value="5">
      <span class="val" id="out-pct">5.00%</span>
    </div>
    <div class="control-row">
      <label>Cap variable por persona (% sueldo fijo)</label>
      <input type="range" id="sl-cap-person" min="0" max="200" step="5" value="50">
      <span class="val" id="out-cap-person">50%</span>
    </div>
    <div class="control-row">
      <label>Ventana de target (meses)</label>
      <input type="range" id="sl-window" min="3" max="18" step="1" value="12">
      <span class="val" id="out-window">12</span>
    </div>
    <div class="control-row">
      <label>Tope nomina total (% fact.)</label>
      <input type="range" id="sl-cap" min="20" max="60" step="0.5" value="30">
      <span class="val" id="out-cap">30%</span>
    </div>
  </div>

  <div class="recommendation" id="recommendation"></div>

  <h2>Tabla mes a mes (comparativa Actual vs Propuesta)</h2>
  <div class="card scroll-x">
    <table id="tbl-monthly"></table>
  </div>

  <h2>Proyeccion anual (12 meses reales mas recientes)</h2>
  <div class="card">
    <table id="tbl-annual"></table>
  </div>

  <div class="grid" style="margin-top: 20px;">
    <div class="card">
      <h2 style="margin-top:0;">Composicion de nomina propuesta por mes</h2>
      <div class="chart-wrap"><canvas id="c-stack"></canvas></div>
    </div>
    <div class="card">
      <h2 style="margin-top:0;">% nomina sobre facturacion</h2>
      <div class="chart-wrap"><canvas id="c-pct"></canvas></div>
    </div>
    <div class="card">
      <h2 style="margin-top:0;">Facturacion vs Target de margen</h2>
      <div class="chart-wrap"><canvas id="c-rev"></canvas></div>
    </div>
    <div class="card">
      <h2 style="margin-top:0;">Delta mensual Propuesta - Actual</h2>
      <div class="chart-wrap"><canvas id="c-delta"></canvas></div>
    </div>
  </div>

  <div class="grid" style="margin-top: 20px;">
    <div class="card">
      <h2 style="margin-top:0;">Top 20 clientes (ultimos 12 m)</h2>
      <div class="scroll-x" style="max-height:320px;">
        <table id="tbl-clients"></table>
      </div>
      <div class="footnote" id="concentration-note"></div>
    </div>
    <div class="card">
      <h2 style="margin-top:0;">Top 20 productos (ultimos 12 m)</h2>
      <div class="scroll-x" style="max-height:320px;">
        <table id="tbl-products"></table>
      </div>
    </div>
  </div>

  <div class="footer">
    Fuente: base de produccion Railway · facturas emitidas (excluye NC, cotizaciones y canceladas)<br>
    Anclas CMV: calculadas en vivo sobre venta real ultimos 18m × ultimo precio FOB conocido por articulo<br>
    Todos los valores en USD, sin cargas sociales · Descuentos aplicados a nivel de linea (post-descuento)
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script id="data-json" type="application/json">__DATA_JSON__</script>
<script>
// -------------------- Data & utils --------------------
const DATA = JSON.parse(document.getElementById('data-json').textContent);
const DEFAULTS = DATA.default_profiles;
const ANCHORS = DATA.po_anchors;
const LS_PROFILES = 'dialfa_sim_v3_profiles';
const LS_SLIDERS  = 'dialfa_sim_v3';

const fmtUsd = v => (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
const fmtSignedUsd = v => (v >= 0 ? '+' : '-') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
const fmtPct = v => (v*100).toFixed(1) + '%';
const fmtMes = s => {
  if (!s) return '';
  const [y,m] = s.split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return months[parseInt(m,10)-1] + " '" + y.slice(2);
};

document.getElementById('gen-date').textContent = DATA.generated_at.replace('T', ' ').slice(0,16);

// -------------------- Profile cards (dynamic rows) --------------------
// Profile state is held in a JS object (PROFILES_STATE) and re-rendered
// imperatively. The DOM inputs reflect it; we read back from the DOM on every
// calc() and write to localStorage for persistence.

let PROFILES_STATE = null;  // populated by initProfiles()

function defaultProfiles() {
  // Deep clone of the server-provided defaults so edits don't mutate them.
  return JSON.parse(JSON.stringify({
    actual:    DEFAULTS.actual,
    propuesta: DEFAULTS.propuesta,
  }));
}

function loadProfiles() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_PROFILES) || 'null');
    if (saved && saved.actual && saved.propuesta
        && Array.isArray(saved.actual.rows) && Array.isArray(saved.propuesta.rows)) {
      return saved;
    }
  } catch(e) {}
  return defaultProfiles();
}

function saveProfiles(p) {
  try { localStorage.setItem(LS_PROFILES, JSON.stringify(p)); } catch(e) {}
}

function rowHtml(key, idx, row) {
  const esc = s => String(s == null ? '' : s).replace(/"/g, '&quot;');
  return `
    <div class="emp-row" data-row-idx="${idx}">
      <input type="text"   class="row-name"   value="${esc(row.name)}" placeholder="Rol / nombre">
      <input type="number" class="row-count"  min="0" step="1"   value="${row.count}">
      <input type="number" class="row-salary" min="0" step="50"  value="${row.salary}">
      <div class="participates-cell">
        <input type="checkbox" class="row-participates" ${row.participates ? 'checked' : ''} title="Participa del pool variable (distribucion equitativa)">
      </div>
      <button type="button" class="btn-remove-row" data-key="${key}" data-idx="${idx}" title="Eliminar fila">×</button>
    </div>
  `;
}

function buildProfileCard(key, p) {
  const cls = key === 'actual' ? 'actual' : 'propuesta';
  const rowsHtml = p.rows.map((r, i) => rowHtml(key, i, r)).join('');
  return `
    <div class="profile-card ${cls}" data-profile="${key}">
      <h3>${p.label}</h3>
      <div class="rows-header">
        <span>Rol / Nombre</span>
        <span>Cant.</span>
        <span>USD/mes</span>
        <span style="text-align:center;">Var.</span>
        <span></span>
      </div>
      <div class="rows-container" id="${key}-rows">${rowsHtml}</div>
      <button type="button" class="btn-add-row" data-key="${key}">+ Agregar rol</button>
      <div class="profile-meta">
        <label>
          Aguinaldo:
          <input type="number" id="${key}-aguinaldo" min="0" max="3" step="0.5" value="${p.aguinaldo_meses}"> meses/año
        </label>
        <label class="chk-var">
          <input type="checkbox" id="${key}-paysvar" ${p.pays_variable ? 'checked' : ''}>
          Paga variable
        </label>
      </div>
      <div class="profile-footer">
        <div class="total">$<span id="${key}-total">0</span>/mes <small>fijo</small></div>
        <div>Anualizado: $<span id="${key}-annual">0</span></div>
      </div>
    </div>
  `;
}

function renderProfileCards() {
  if (!PROFILES_STATE) PROFILES_STATE = loadProfiles();
  document.getElementById('profiles').innerHTML =
    buildProfileCard('actual',    PROFILES_STATE.actual) +
    buildProfileCard('propuesta', PROFILES_STATE.propuesta);
  attachProfileListeners();
}

function attachProfileListeners() {
  // Row input events (propagate to render via delegation-like pattern)
  ['actual','propuesta'].forEach(key => {
    const container = document.getElementById(`${key}-rows`);
    container.querySelectorAll('.row-name, .row-count, .row-salary')
      .forEach(el => el.addEventListener('input', render));
    container.querySelectorAll('.row-participates')
      .forEach(el => el.addEventListener('change', render));
    document.getElementById(`${key}-aguinaldo`).addEventListener('input', render);
    document.getElementById(`${key}-paysvar`).addEventListener('change', render);
  });
  // Add row buttons
  document.querySelectorAll('.btn-add-row').forEach(btn => {
    btn.addEventListener('click', () => addRow(btn.dataset.key));
  });
  // Remove row buttons
  document.querySelectorAll('.btn-remove-row').forEach(btn => {
    btn.addEventListener('click', () => removeRow(btn.dataset.key, parseInt(btn.dataset.idx, 10)));
  });
}

function addRow(profileKey) {
  syncStateFromDom();
  PROFILES_STATE[profileKey].rows.push({
    name: "Nuevo", count: 1, salary: 1000, participates: true
  });
  saveProfiles(PROFILES_STATE);
  renderProfileCards();
  render();
}

function removeRow(profileKey, idx) {
  syncStateFromDom();
  PROFILES_STATE[profileKey].rows.splice(idx, 1);
  saveProfiles(PROFILES_STATE);
  renderProfileCards();
  render();
}

function syncStateFromDom() {
  // Pulls current DOM values into PROFILES_STATE (before rerender, so we
  // don't lose unsaved edits on add/remove).
  ['actual','propuesta'].forEach(key => {
    const rows = Array.from(document.querySelectorAll(`#${key}-rows .emp-row`)).map(el => ({
      name:         el.querySelector('.row-name').value || '',
      count:        Math.max(0, parseFloat(el.querySelector('.row-count').value)  || 0),
      salary:       Math.max(0, parseFloat(el.querySelector('.row-salary').value) || 0),
      participates: el.querySelector('.row-participates').checked,
    }));
    PROFILES_STATE[key].rows            = rows;
    PROFILES_STATE[key].aguinaldo_meses = Math.max(0, parseFloat(document.getElementById(`${key}-aguinaldo`).value) || 0);
    PROFILES_STATE[key].pays_variable   = document.getElementById(`${key}-paysvar`).checked;
  });
}

function readProfile(which) {
  const p = PROFILES_STATE[which];
  const fijo         = p.rows.reduce((a, r) => a + r.count * r.salary, 0);
  const participants = p.rows.reduce((a, r) => a + (r.participates ? r.count : 0), 0);
  return {
    key: which,
    label: DEFAULTS[which].label,
    rows: p.rows,
    aguinaldo_meses: p.aguinaldo_meses,
    pays_variable:   p.pays_variable,
    fijo:            fijo,
    participants:    participants,
    annual:          fijo * (12 + p.aguinaldo_meses),
  };
}

function resetProfiles() {
  localStorage.removeItem(LS_PROFILES);
  PROFILES_STATE = defaultProfiles();
  renderProfileCards();
  render();
}

function resetCompanyCosts() {
  const d = DATA.default_company_costs || {};
  document.getElementById('costo-fijo').value    = d.fixed_usd_month    ?? 0;
  document.getElementById('costo-var-pct').value = d.variable_pct_sales ?? 0;
  document.getElementById('owner-draw').value    = d.owner_draw_usd     ?? 0;
  document.getElementById('payroll-tax').value   = d.payroll_tax_pct    ?? 40;
  render();
}

// -------------------- Anchors + Data quality --------------------
const CA = DATA.cost_anchors || {};

function renderAnchors() {
  const anchorsHtml = [
    { l: 'FOB ' + CA.cmv_fob_pct + '%',       v: CA.cmv_fob_pct },
    { l: 'CIF×1.5 ' + CA.cmv_cif_pct + '%',   v: CA.cmv_cif_pct },
    { l: 'Landed ' + CA.cmv_landed_pct + '%', v: CA.cmv_landed_pct },
    { l: 'PO Landed 32.4%', v: 32.4 },
    { l: 'Conservador 40%', v: 40 },
  ];
  document.getElementById('anchors').innerHTML =
    '<span style="color:var(--muted);">Anclas CMV (venta real × FOB conocido):</span>' +
    anchorsHtml.map(a => `<span class="anchor" data-v="${a.v}">${a.l}</span>`).join('') +
    ` <button class="btn-reset" id="btn-reset-cmv" style="margin-left:8px;">↺ Reset CMV al ancla Landed</button>` +
    ` <button class="btn-reset" id="btn-reset-profiles" style="margin-left:auto;">↺ Reset perfiles al Excel</button>`;
  document.querySelectorAll('.anchor').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('sl-cmv').value = el.dataset.v;
      render();
    });
  });
  document.getElementById('btn-reset-cmv').addEventListener('click', () => {
    document.getElementById('sl-cmv').value = CA.cmv_landed_pct;
    render();
  });
  document.getElementById('btn-reset-profiles').addEventListener('click', resetProfiles);
}

function renderExcelReference() {
  const ref = DATA.excel_reference;
  if (!ref) return;
  const getInput = id => parseFloat(document.getElementById(id).value) || 0;
  const diffTag = (user, real, tol = 0.2) => {
    if (real === 0) return '';
    const diff = Math.abs(user - real) / real;
    if (diff <= tol) return '<span class="ref-item-diff ok">~ ok</span>';
    const lower = user < real;
    const cls = diff > 0.5 ? 'bad' : 'warn';
    return `<span class="ref-item-diff ${cls}">${lower ? 'bajo' : 'alto'} ${((user/real - 1)*100).toFixed(0)}%</span>`;
  };
  const userFijo = getInput('costo-fijo');
  const userVar = getInput('costo-var-pct');
  const userDraw = getInput('owner-draw');
  const notesList = (ref.notes || []).map(n => `<li>${n}</li>`).join('');
  document.getElementById('excel-reference-card').innerHTML = `
    <div class="ref-card">
      <div class="ref-card-title">📊 Referencia real — ${ref.source}</div>
      <div class="ref-grid">
        <div class="ref-item">
          <span class="ref-item-label">Costos fijos (USD/mes)</span>
          <span class="ref-item-val">${fmtUsd(ref.fixed_usd_month)}</span>
          <span>tu input: ${fmtUsd(userFijo)} ${diffTag(userFijo, ref.fixed_usd_month)}</span>
        </div>
        <div class="ref-item">
          <span class="ref-item-label">Costos variables (% venta)</span>
          <span class="ref-item-val">${ref.variable_pct_sales.toFixed(1)}%</span>
          <span>tu input: ${userVar.toFixed(1)}% ${diffTag(userVar, ref.variable_pct_sales)}</span>
        </div>
        <div class="ref-item">
          <span class="ref-item-label">Retiros socio (USD/mes)</span>
          <span class="ref-item-val">${fmtUsd(ref.owner_draw_usd)}</span>
          <span>tu input: ${fmtUsd(userDraw)} ${diffTag(userDraw, ref.owner_draw_usd)}</span>
        </div>
        <div class="ref-item">
          <span class="ref-item-label">Margen de caja real</span>
          <span class="ref-item-val">${ref.cash_margin_pct.toFixed(1)}%</span>
          <span style="color:var(--muted);">ingresos−egresos totales</span>
        </div>
      </div>
      <div class="ref-notes">
        <b>Notas del extracto:</b>
        <ul>${notesList}</ul>
      </div>
    </div>
  `;
}

function renderDataQuality() {
  const calidad = CA.calidad || 'baja';
  const calidadLabel = calidad === 'alta' ? 'ALTA' : calidad === 'media' ? 'MEDIA' : 'BAJA';
  const el = document.getElementById('data-quality');
  el.className = 'data-quality dq-' + calidad;
  el.innerHTML = `
    <div class="dq-header">
      <span class="dq-badge dq-${calidad}">Calidad del dato: ${calidadLabel}</span>
      <span class="dq-meta">
        Cobertura: <b>${CA.cobertura_pct}%</b> de la facturacion ·
        <b>${CA.articulos_con_costo}</b> de <b>${CA.articulos_facturados}</b> articulos vendidos con costo cargado ·
        <b>${CA.proformas_cargadas}</b> proformas en la base
      </span>
    </div>
    <div class="dq-detail">
      CMV calculado con <code>SUM(qty × FOB_unitario) / SUM(venta USD)</code> sobre los ultimos 18 meses,
      usando el ultimo precio de proforma conocido por articulo (${fmtUsd(CA.fob_total_cubierto)} FOB sobre ${fmtUsd(CA.venta_cubierta_usd)} de venta cubierta).
      Para mejorar la precision, carga mas proformas en supplier_orders y volve a correr el script — las anclas se recalculan automaticamente.
    </div>
  `;
}

// -------------------- Frequency helpers --------------------
const FREQ_MONTHS = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };

// Core calc: computes per-month table with variable pool distributed by period.
// The pool is calculated on the operating margin excedente over a period,
// then distributed EQUALLY among participating persons, capped per person.
function calc() {
  const cmv          = parseFloat(document.getElementById('sl-cmv').value) / 100;
  const pct          = parseFloat(document.getElementById('sl-pct').value) / 100;
  const windowN      = parseInt(document.getElementById('sl-window').value, 10);
  const capTot       = parseFloat(document.getElementById('sl-cap').value) / 100;
  const capPerson    = parseFloat(document.getElementById('sl-cap-person').value) / 100;

  // Company operating costs
  const costoFijoEmp  = Math.max(0, parseFloat(document.getElementById('costo-fijo').value)    || 0);
  const costoVarPct   = Math.max(0, parseFloat(document.getElementById('costo-var-pct').value) || 0) / 100;
  const ownerDraw     = Math.max(0, parseFloat(document.getElementById('owner-draw').value)    || 0);
  const payrollTaxPct = Math.max(0, parseFloat(document.getElementById('payroll-tax').value)   || 0) / 100;

  // Variable config
  const frequency  = document.getElementById('var-frequency').value;
  const dataSource = document.getElementById('data-source').value;  // facturacion | cobranza
  const freqN      = FREQ_MONTHS[frequency] || 3;

  document.getElementById('out-cmv').textContent        = (cmv*100).toFixed(1) + '%';
  document.getElementById('out-pct').textContent        = (pct*100).toFixed(2) + '%';
  document.getElementById('out-window').textContent     = windowN;
  document.getElementById('out-cap').textContent        = (capTot*100).toFixed(0) + '%';
  document.getElementById('out-cap-person').textContent = (capPerson*100).toFixed(0) + '%';

  // Pull current state from DOM into PROFILES_STATE before reading
  syncStateFromDom();
  saveProfiles(PROFILES_STATE);

  const act  = readProfile('actual');
  const prop = readProfile('propuesta');

  // Update profile card footers (tax-adjusted subtitle)
  const costCoefFn = p => p.fijo * (1 + payrollTaxPct);
  document.getElementById('actual-total').textContent     = act.fijo.toLocaleString('en-US');
  document.getElementById('actual-annual').textContent    = Math.round(costCoefFn(act) * (12 + act.aguinaldo_meses)).toLocaleString('en-US');
  document.getElementById('propuesta-total').textContent  = prop.fijo.toLocaleString('en-US');
  document.getElementById('propuesta-annual').textContent = Math.round(costCoefFn(prop) * (12 + prop.aguinaldo_meses)).toLocaleString('en-US');

  const months = DATA.monthly;

  // Select the revenue series based on the data source toggle.
  const rev = m => (dataSource === 'cobranza' ? (m.cobranza_usd || 0) : (m.net_usd || 0));

  const wnd = months.slice(-windowN);

  // Operating margin per month = venta - CMV - costo_fijo - costo_variable(% venta) - retiro socio
  const opMargin = m => {
    const r = rev(m);
    return r * (1 - cmv - costoVarPct) - costoFijoEmp - ownerDraw;
  };
  const avgOpMargin = wnd.reduce((a,m)=>a+opMargin(m),0) / Math.max(wnd.length, 1);
  const target      = avgOpMargin;   // target mensual

  // First pass: compute base per-month values
  const rowsBase = months.map(m => {
    const r             = rev(m);
    const cmvUsd        = r * cmv;
    const margenBruto   = r - cmvUsd;
    const costoVarMes   = r * costoVarPct;
    const margenOp      = margenBruto - costoFijoEmp - costoVarMes - ownerDraw;
    return {
      mes: m.mes,
      rev: r,                              // la fuente ACTIVA (cobranza o facturacion)
      revFact: m.net_usd || 0,             // facturacion siempre (para columna informativa)
      revCob:  m.cobranza_usd || 0,        // cobranza siempre (para columna informativa)
      cmvUsd, margenBruto, costoVarMes, ownerDrawMes: ownerDraw, margenOp
    };
  });

  // Second pass: group into periods and compute variable pool per period.
  // Periods are aligned from the end backwards (most recent N months = last period).
  // For each period: excedente = sum(margenOp) - sum(target) = sum(margenOp) - freqN*target
  // Pool is distributed equally among participating persons, capped per-person.
  const periods = [];
  for (let end = rowsBase.length; end > 0; end -= freqN) {
    const start = Math.max(0, end - freqN);
    const slice = rowsBase.slice(start, end);
    const sumMargenOp = slice.reduce((a,r)=>a+r.margenOp, 0);
    const periodTarget = target * slice.length;
    const excedente = Math.max(0, sumMargenOp - periodTarget);

    // For each profile, distribute equally among participants.
    // Per-person base variable = excedente * pct (un share igual entre los participantes)
    // Total pool = participants * excedente * pct
    function distributeFor(profile) {
      if (!profile.pays_variable || profile.participants === 0) {
        return { poolRaw: 0, poolCapped: 0, perPerson: 0, capPerPerson: 0, capHit: false };
      }
      const perPersonRaw = excedente * pct;
      // Cap por persona: cap_pct × sueldo mensual × meses del periodo
      // (para trimestral: cap_pct × sueldo × 3)
      // Usamos el promedio de sueldos de los participantes para el cap
      const avgSalaryParticipants = profile.rows
        .filter(r => r.participates)
        .reduce((a,r)=>a + r.count * r.salary, 0) / profile.participants;
      const capPerPerson = capPerson * avgSalaryParticipants * slice.length;
      const perPersonCapped = Math.min(perPersonRaw, capPerPerson);
      const capHit = perPersonRaw > capPerPerson;
      const poolRaw    = perPersonRaw    * profile.participants;
      const poolCapped = perPersonCapped * profile.participants;
      return { poolRaw, poolCapped, perPerson: perPersonCapped, capPerPerson, capHit };
    }

    const distAct  = distributeFor(act);
    const distProp = distributeFor(prop);

    periods.unshift({
      startIdx: start, endIdx: end - 1,
      startMes: slice[0].mes, endMes: slice[slice.length - 1].mes,
      months: slice.length,
      sumMargenOp, periodTarget, excedente,
      act:  distAct,
      prop: distProp,
    });
  }

  // Third pass: for each month, assign the pool to the LAST month of its period
  // (cash flow: variable is paid at the end of the period).
  const monthToPeriod = new Map();
  periods.forEach((p, pi) => {
    for (let i = p.startIdx; i <= p.endIdx; i++) {
      monthToPeriod.set(i, { period: p, isLast: (i === p.endIdx), pi });
    }
  });

  const rows = rowsBase.map((rb, i) => {
    const info = monthToPeriod.get(i);
    const period = info.period;
    const isPeriodEnd = info.isLast;

    // Show pool only on the last month of the period (cash event).
    const poolAct  = isPeriodEnd ? period.act.poolCapped  : 0;
    const poolProp = isPeriodEnd ? period.prop.poolCapped : 0;

    // Nomina = (fijo + variable) × (1 + cargas sociales)
    const nominaActBase  = act.fijo  + poolAct;
    const nominaPropBase = prop.fijo + poolProp;
    const nominaAct  = nominaActBase  * (1 + payrollTaxPct);
    const nominaProp = nominaPropBase * (1 + payrollTaxPct);

    return {
      ...rb,
      costoFijoMes: costoFijoEmp,
      excedente:  isPeriodEnd ? period.excedente : 0,
      periodInfo: { pi: info.pi, isLast: isPeriodEnd, months: period.months,
                    startMes: period.startMes, endMes: period.endMes },
      poolAct, poolProp,
      perPersonAct:  isPeriodEnd ? period.act.perPerson  : 0,
      perPersonProp: isPeriodEnd ? period.prop.perPerson : 0,
      capHitProp:    isPeriodEnd && period.prop.capHit,
      nominaAct, nominaProp,
      delta:      nominaProp - nominaAct,
      deltaRaise: (prop.fijo - act.fijo) * (1 + payrollTaxPct),
      deltaVar:   (poolProp - poolAct) * (1 + payrollTaxPct),
      pctAct:  rb.rev > 0 ? nominaAct  / rb.rev : 0,
      pctProp: rb.rev > 0 ? nominaProp / rb.rev : 0,
      overCapAct:  rb.rev > 0 && (nominaAct  / rb.rev > capTot),
      overCapProp: rb.rev > 0 && (nominaProp / rb.rev > capTot),
      profitAct:  rb.margenOp - nominaAct,
      profitProp: rb.margenOp - nominaProp,
    };
  });

  return {
    cmv, pct, windowN, cap: capTot, capPerson,
    costoFijoEmp, costoVarPct, ownerDraw, payrollTaxPct,
    frequency, freqN, dataSource,
    target, rows, act, prop, periods
  };
}

// -------------------- KPIs --------------------
function renderKpis(result) {
  const s = DATA.summary;
  const { act, prop, rows } = result;
  const last12 = rows.slice(-12);
  const totRev12 = last12.reduce((a,r)=>a+r.rev,0);
  const totMgOp  = last12.reduce((a,r)=>a+r.margenOp,0);
  const totNomAct = last12.reduce((a,r)=>a+r.nominaAct,0)  + act.fijo  * act.aguinaldo_meses;
  const totNomProp = last12.reduce((a,r)=>a+r.nominaProp,0) + prop.fijo * prop.aguinaldo_meses;
  const totDelta = totNomProp - totNomAct;
  const pctActAnual  = totRev12 > 0 ? 100*totNomAct  / totRev12 : 0;
  const pctPropAnual = totRev12 > 0 ? 100*totNomProp / totRev12 : 0;
  const pctMgOp = totRev12 > 0 ? 100*totMgOp / totRev12 : 0;

  const kpis = [
    { label: 'Fact. promedio 12m', val: fmtUsd(s.avg_net_12m), sub: 'neto, sin IVA', cls: '' },
    { label: 'Mejor mes (12m)',    val: fmtUsd(s.max_month.usd), sub: fmtMes(s.max_month.mes), cls: '' },
    { label: 'Margen operativo 12m', val: fmtUsd(totMgOp), sub: pctMgOp.toFixed(1) + '% venta · pre-nomina', cls: '' },
    { label: 'Nomina ACTUAL',      val: fmtUsd(act.fijo),  sub: pctActAnual.toFixed(1)  + '% anual · ' + act.rows.reduce((a,r)=>a+r.count,0) + ' personas', cls: 'highlight-act' },
    { label: 'Nomina PROPUESTA',   val: fmtUsd(prop.fijo), sub: pctPropAnual.toFixed(1) + '% anual · ' + prop.rows.reduce((a,r)=>a+r.count,0) + ' personas', cls: 'highlight-prop' },
    { label: 'Δ anual nomina',     val: fmtSignedUsd(totDelta), sub: 'propuesta − actual', cls: 'highlight-delta' },
  ];
  document.getElementById('kpis').innerHTML = kpis.map(k =>
    `<div class="kpi ${k.cls}"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.val}</div><div class="kpi-sub">${k.sub}</div></div>`
  ).join('');
}

// -------------------- Inventory status --------------------
function renderInventoryStatus() {
  const sv = DATA.stock_valuation || [];
  if (sv.length === 0) {
    document.getElementById('inventory-block').innerHTML = '<div style="color:var(--muted);font-size:12px;">Sin datos de stock disponibles.</div>';
    return;
  }

  const statusConfig = {
    'ACTIVE':      { label: 'Activo',            cls: 'active', emoji: '🟢', desc: 'Vendido en ultimos 90 dias, avg >= 5 uds/mes' },
    'SLOW_MOVING': { label: 'Movimiento Lento',  cls: 'slow',   emoji: '🟡', desc: 'Vendido en ultimos 180 dias, bajo volumen' },
    'DEAD_STOCK':  { label: 'Stock Muerto',       cls: 'dead',   emoji: '🔴', desc: 'Sin ventas en 365+ dias' },
    'NEVER_SOLD':  { label: 'Nunca Vendido',      cls: 'never',  emoji: '⚫', desc: 'Nunca se vendio, con stock > 0' },
  };

  // Totals
  const totRetail = sv.reduce((a, s) => a + (s.valor_retail || 0), 0);
  const totCosto  = sv.reduce((a, s) => a + (s.valor_costo || 0), 0);
  const totArts   = sv.reduce((a, s) => a + (s.articulos || 0), 0);
  const totUnits  = sv.reduce((a, s) => a + (s.unidades || 0), 0);

  // FOB/retail ratio for estimating cost of articles without known cost
  const totCostoConocido = sv.reduce((a, s) => a + (s.valor_costo_conocido || 0), 0);
  const retailOfKnown = sv.reduce((a, s) => {
    const ratio = s.articulos_con_costo > 0 ? s.valor_costo_conocido / Math.max(s.valor_retail, 1) : 0;
    return a; // not used directly, we compute global
  }, 0);
  const fobRetailRatio = totRetail > 0 ? totCostoConocido / totRetail : 0.18;

  // Dead + never sold
  const deadStatuses = ['DEAD_STOCK', 'NEVER_SOLD'];
  const deadRows = sv.filter(s => deadStatuses.includes(s.status));
  const deadRetail = deadRows.reduce((a, s) => a + (s.valor_retail || 0), 0);
  const deadEstCost = deadRetail * (fobRetailRatio > 0 ? fobRetailRatio : 0.18);
  const deadArts = deadRows.reduce((a, s) => a + (s.articulos || 0), 0);

  // Annual facturacion for rotation
  const s = DATA.summary;
  const annualRev = s.total_sales_12m || 0;
  const rotationYears = annualRev > 0 ? totRetail / annualRev : 999;

  // Liquidation potential
  const liquidationAt50pct = deadRetail * 0.50;

  // Cards HTML
  const cardsHtml = ['ACTIVE', 'SLOW_MOVING', 'DEAD_STOCK', 'NEVER_SOLD'].map(status => {
    const row = sv.find(s => s.status === status) || { articulos:0, unidades:0, valor_retail:0, valor_costo:0, valor_costo_conocido:0, articulos_con_costo:0 };
    const cfg = statusConfig[status];
    const pctRetail = totRetail > 0 ? (row.valor_retail / totRetail * 100).toFixed(1) : '0.0';
    const estCosto = row.valor_retail * (fobRetailRatio > 0 ? fobRetailRatio : 0.18);
    return `
      <div class="inv-card ${cfg.cls}">
        <div class="inv-card-title">${cfg.emoji} ${cfg.label} <span class="count">${row.articulos}</span></div>
        <div class="inv-metric"><span class="label">Unidades</span><span class="val">${Math.round(row.unidades).toLocaleString()}</span></div>
        <div class="inv-metric"><span class="label">Precio lista</span><span class="val">${fmtUsd(row.valor_retail)}</span></div>
        <div class="inv-metric"><span class="label">Costo FOB conocido</span><span class="val">${fmtUsd(row.valor_costo_conocido)} <span style="color:var(--muted);font-size:10px;">(${row.articulos_con_costo} arts)</span></span></div>
        <div class="inv-metric"><span class="label">Costo estimado</span><span class="val">~${fmtUsd(estCosto)}</span></div>
        <div class="inv-metric"><span class="label">% del total</span><span class="val">${pctRetail}%</span></div>
      </div>
    `;
  }).join('');

  // Summary insights
  const insightsHtml = `
    <div class="inv-summary">
      <div class="inv-insight">
        <b>Rotacion global:</b> el stock a precio lista (${fmtUsd(totRetail)}) equivale a
        <span class="${rotationYears > 10 ? 'neg' : rotationYears > 3 ? '' : 'hl'}">${rotationYears.toFixed(1)} años</span>
        de facturacion al ritmo actual (${fmtUsd(annualRev)}/año).
        Costo FOB conocido: ${fmtUsd(totCostoConocido)} (de ${sv.reduce((a,s)=>a+s.articulos_con_costo,0)} articulos con proforma).
        Costo total estimado (ratio ${(fobRetailRatio*100).toFixed(1)}%): ~${fmtUsd(totRetail * fobRetailRatio)}.
      </div>
      <div class="inv-insight">
        <b>Dead stock + Nunca vendido:</b> <span class="neg">${deadArts} articulos</span> (${(100*deadArts/Math.max(totArts,1)).toFixed(0)}% del catalogo con stock) con
        ${fmtUsd(deadRetail)} a precio lista y ~${fmtUsd(deadEstCost)} de costo estimado.
        <br><br>
        <b>Potencial de liberacion:</b> si se liquidara al 50% del precio lista, se generarian
        <span class="hl">${fmtUsd(liquidationAt50pct)}</span> de cash
        — equivalente a ${annualRev > 0 ? (liquidationAt50pct / annualRev * 12).toFixed(0) : '?'} meses de facturacion.
      </div>
      <div class="inv-insight">
        <b>Impacto en compensacion:</b> la empresa tiene ~${fmtUsd(totRetail * fobRetailRatio)} de capital real atado en stock.
        No necesita "reserva para reponer mercaderia" en el corto plazo — tiene stock para ${rotationYears.toFixed(0)}+ años.
        La prioridad es ROTAR el stock existente (especialmente los ${deadArts} articulos muertos) para liberar capital
        que puede financiar el esquema de compensacion.
      </div>
    </div>
  `;

  document.getElementById('inventory-block').innerHTML = cardsHtml + insightsHtml;
}

// -------------------- Unit economics global --------------------
// Calcula la viabilidad estructural del negocio: contribution margin,
// overhead anual, break-even requerido, utilidad real y gap de pricing
// (markup actual vs markup necesario para absorber todo el overhead).
function renderUnitEconomics(result) {
  const { rows, act, prop, cmv, costoFijoEmp, costoVarPct, ownerDraw, payrollTaxPct, dataSource } = result;
  const last12 = rows.slice(-12);
  const totRev = last12.reduce((a,r) => a + r.rev, 0);
  const totCmv = last12.reduce((a,r) => a + r.cmvUsd, 0);
  const totCostoVar = last12.reduce((a,r) => a + r.costoVarMes, 0);

  // Contribution margin = ingresos - CMV - variables empresa
  const contribAnnual = totRev - totCmv - totCostoVar;
  const contribRatio  = totRev > 0 ? contribAnnual / totRev : 0;

  // Overhead anual (lo que NO escala con ventas)
  const nomPropAnual = prop.fijo * (12 + prop.aguinaldo_meses) * (1 + payrollTaxPct);
  const nomActAnual  = act.fijo  * (12 + act.aguinaldo_meses)  * (1 + payrollTaxPct);
  const costoFijoAnual = costoFijoEmp * 12;
  const retirosAnual   = ownerDraw * 12;

  const overheadAnualProp = costoFijoAnual + retirosAnual + nomPropAnual;
  const overheadAnualAct  = costoFijoAnual + retirosAnual + nomActAnual;

  // Break-even = overhead / contribution_ratio
  const breakEvenProp = contribRatio > 0 ? overheadAnualProp / contribRatio : Infinity;
  const breakEvenAct  = contribRatio > 0 ? overheadAnualAct  / contribRatio : Infinity;

  // Utilidad = contribution margin - overhead
  const utilAct  = contribAnnual - overheadAnualAct;
  const utilProp = contribAnnual - overheadAnualProp;

  // Cobertura (actual / break-even) usando propuesta como referencia
  const coberturaProp = (breakEvenProp > 0 && isFinite(breakEvenProp)) ? (totRev / breakEvenProp) : 0;

  // Margin vs Markup analysis
  // ==========================
  // Dos formas equivalentes de medir la relacion precio/costo:
  //
  //  MARGEN (sobre venta)    = (venta - costo) / venta     -- base = precio de venta
  //  MARKUP (sobre costo)    = (venta - costo) / costo     -- base = costo
  //
  //  Relacion: margen = markup / (1 + markup)
  //            markup = margen / (1 - margen)
  //
  // Ejemplo con CMV Landed = 29.2%:
  //   margen bruto sobre venta = 1 - 0.292 = 70.8%
  //   markup sobre landed      = 1 / 0.292 = 3.43x
  //
  // Ambos numeros describen lo mismo: "por cada $100 que vendes, $29.20 es costo
  // y $70.80 es margen bruto". El markup lo dice como multiplicador del costo
  // (3.43x), el margen como porcentaje del precio (70.8%).
  //
  // Para break-even necesitamos:
  //   contribution_margin_ratio = overhead_ratio
  //   (1 - cmv' - costoVarPct) = overhead_ratio
  //   margen_bruto' = 1 - cmv' = overhead_ratio + costoVarPct
  //   markup' = 1 / cmv' = 1 / (1 - margen_bruto')

  const overheadRatioProp = totRev > 0 ? overheadAnualProp / totRev : 0;

  // MARGEN BRUTO (sobre venta)
  const margenBrutoActual    = 1 - cmv;                         // ej: 70.8%
  const margenBrutoNecesario = overheadRatioProp + costoVarPct; // puede ser > 100% (imposible)
  const margenBrutoImposible = margenBrutoNecesario >= 1.0;

  // MARKUP sobre LANDED (base = CMV del simulador, ya incluye FOB + flete + aranceles)
  const markupActualLanded = cmv > 0 ? 1 / cmv : 0;
  const cmvNecesario = Math.max(0.01, 1 - costoVarPct - overheadRatioProp);
  const markupNecesarioLanded = (cmvNecesario > 0 && !margenBrutoImposible) ? 1 / cmvNecesario : Infinity;
  const pricingGap = (isFinite(markupNecesarioLanded) && markupNecesarioLanded > markupActualLanded)
    ? ((markupNecesarioLanded / markupActualLanded) - 1) * 100
    : 0;

  // MARKUP sobre FOB puro (landed / FOB ~= 1.8 desde anclas empiricas PO-16/17)
  const landedOverFob = 1.8;
  const markupActualFob    = markupActualLanded    * landedOverFob;
  const markupNecesarioFob = isFinite(markupNecesarioLanded) ? markupNecesarioLanded * landedOverFob : Infinity;

  // Clases de color segun salud
  const utilClass = v => v > 0 ? 'ok' : (v < 0 ? 'bad' : 'warn');
  const covClass  = c => c >= 1 ? 'ok' : (c >= 0.7 ? 'warn' : 'bad');
  const gapClass  = g => g <= 10 ? 'ok' : (g <= 30 ? 'warn' : 'bad');

  // Formateo del markup necesario (puede ser Infinity si el overhead supera el revenue)
  const markupNecesarioLandedStr = isFinite(markupNecesarioLanded) ? markupNecesarioLanded.toFixed(1) + 'x' : '∞';
  const markupNecesarioFobStr    = isFinite(markupNecesarioFob)    ? markupNecesarioFob.toFixed(1)    + 'x' : '∞';
  // Formateo del margen necesario (puede ser > 100% = imposible matematicamente)
  const margenBrutoNecesarioStr = margenBrutoImposible
    ? '&gt;100% imposible'
    : (margenBrutoNecesario*100).toFixed(1) + '%';

  const html = `
    <div class="ue-grid">
      <div class="ue-card">
        <div class="ue-label">${dataSource === 'cobranza' ? 'Cobranza' : 'Facturacion'} anual</div>
        <div class="ue-value">${fmtUsd(totRev)}</div>
        <div class="ue-sub">12m reales</div>
      </div>
      <div class="ue-card">
        <div class="ue-label">Contribution margin</div>
        <div class="ue-value">${(contribRatio*100).toFixed(1)}%</div>
        <div class="ue-sub">${fmtUsd(contribAnnual)} (despues de CMV + var. empresa)</div>
      </div>
      <div class="ue-card ${utilClass(utilAct)}">
        <div class="ue-label">Utilidad anual ACTUAL</div>
        <div class="ue-value ${utilAct >= 0 ? 'pos' : 'neg'}">${fmtSignedUsd(utilAct)}</div>
        <div class="ue-sub">${utilAct >= 0 ? 'ganancia' : 'perdida'} operativa real</div>
      </div>
      <div class="ue-card ${utilClass(utilProp)}">
        <div class="ue-label">Utilidad anual PROPUESTA</div>
        <div class="ue-value ${utilProp >= 0 ? 'pos' : 'neg'}">${fmtSignedUsd(utilProp)}</div>
        <div class="ue-sub">con fijo aumentado</div>
      </div>
      <div class="ue-card ${covClass(coberturaProp)}">
        <div class="ue-label">Break-even requerido (prop.)</div>
        <div class="ue-value">${isFinite(breakEvenProp) ? fmtUsd(breakEvenProp) : '∞'}</div>
        <div class="ue-sub">${isFinite(breakEvenProp) ? fmtUsd(breakEvenProp/12)+'/mes · cobertura: '+(coberturaProp*100).toFixed(0)+'%' : 'contribution margin &lt;= 0'}</div>
      </div>
      <div class="ue-card ${gapClass(pricingGap)}">
        <div class="ue-label">Margen bruto (sobre venta)</div>
        <div class="ue-value">${(margenBrutoActual*100).toFixed(1)}% <span style="font-size:13px;color:var(--muted);">&rarr; ${margenBrutoNecesarioStr}</span></div>
        <div class="ue-sub">actual &rarr; necesario · venta − CMV, sobre venta</div>
      </div>
      <div class="ue-card ${gapClass(pricingGap)}">
        <div class="ue-label">Markup sobre landed (CMV)</div>
        <div class="ue-value">${markupActualLanded.toFixed(1)}x <span style="font-size:13px;color:var(--muted);">&rarr; ${markupNecesarioLandedStr}</span></div>
        <div class="ue-sub">1 / CMV · cuantas veces el costo vendes el producto</div>
      </div>
      <div class="ue-card ${gapClass(pricingGap)}">
        <div class="ue-label">Markup sobre FOB puro</div>
        <div class="ue-value">${markupActualFob.toFixed(1)}x <span style="font-size:13px;color:var(--muted);">&rarr; ${markupNecesarioFobStr}</span></div>
        <div class="ue-sub">= markup landed × 1.8 (landed/FOB de anclas PO)</div>
      </div>
    </div>
    <div class="ue-footer">
      Overhead anual: ${fmtUsd(overheadAnualProp)} (fijos + retiros + nomina c/cargas) · Contribution margin: ${(contribRatio*100).toFixed(1)}% ·
      Cobertura ${(coberturaProp*100).toFixed(0)}%: ${coberturaProp >= 1 ? 'break-even cubierto' : 'por debajo del break-even'}
    </div>
  `;
  document.getElementById('unit-economics').innerHTML = html;
}

// -------------------- Totalizer banner (ingresos - egresos) --------------------
function renderTotalizer(result) {
  const { rows, act, prop, costoFijoEmp, costoVarPct, ownerDraw, payrollTaxPct, dataSource } = result;
  const last12 = rows.slice(-12);
  const totRev = last12.reduce((a,r) => a + r.rev, 0);
  const totCmv = last12.reduce((a,r) => a + r.cmvUsd, 0);
  const totCostoFijoAnual = costoFijoEmp * 12;
  const totCostoVarAnual  = last12.reduce((a,r) => a + r.costoVarMes, 0);
  const totOwnerDrawAnual = ownerDraw * 12;

  // Nomina base (sin cargas) × (1 + cargas)
  function totNomina(profile, poolKey) {
    const fijo12 = profile.fijo * 12;
    const agui   = profile.fijo * profile.aguinaldo_meses;
    const pool12 = last12.reduce((a,r) => a + (r[poolKey] || 0), 0) / (1 + payrollTaxPct);
    return (fijo12 + agui + pool12) * (1 + payrollTaxPct);
  }
  const totNomAct  = totNomina(act,  'poolAct');
  const totNomProp = totNomina(prop, 'poolProp');

  // Egresos totales = CMV + costos fijos + costos var + retiros socio + nomina total
  const egresosAct  = totCmv + totCostoFijoAnual + totCostoVarAnual + totOwnerDrawAnual + totNomAct;
  const egresosProp = totCmv + totCostoFijoAnual + totCostoVarAnual + totOwnerDrawAnual + totNomProp;

  const resultadoAct  = totRev - egresosAct;
  const resultadoProp = totRev - egresosProp;

  const cls = v => v > 0 ? 'pos' : (v < 0 ? 'neg' : '');
  const sourceLabel = dataSource === 'cobranza' ? 'Cobranza' : 'Facturacion';

  document.getElementById('totalizer-banner').innerHTML = `
    <div class="totalizer-title">📈 Totalizador anual — Ingresos − Egresos totales (12 meses)</div>
    <div class="totalizer-grid">
      <div class="totalizer-col">
        <span class="label">${sourceLabel} anual</span>
        <span class="value">${fmtUsd(totRev)}</span>
        <span class="sub">12 meses cerrados</span>
      </div>
      <div class="totalizer-col ${cls(resultadoAct)}">
        <span class="label">Resultado con nomina ACTUAL</span>
        <span class="value">${fmtSignedUsd(resultadoAct)}</span>
        <span class="sub">egresos totales: ${fmtUsd(egresosAct)}</span>
      </div>
      <div class="totalizer-col ${cls(resultadoProp)}">
        <span class="label">Resultado con nomina PROPUESTA</span>
        <span class="value">${fmtSignedUsd(resultadoProp)}</span>
        <span class="sub">egresos totales: ${fmtUsd(egresosProp)} · Δ ${fmtSignedUsd(resultadoProp - resultadoAct)}</span>
      </div>
    </div>
  `;
}

// -------------------- Monthly table --------------------
function renderMonthly(result) {
  const { rows, target, cap, act, prop, costoFijoEmp, costoVarPct, dataSource } = result;
  const hasCostoFijo = costoFijoEmp > 0;
  const hasCostoVar  = costoVarPct > 0;
  const showCosts = hasCostoFijo || hasCostoVar;
  // Headers: las dos fuentes siempre visibles, la activa resaltada
  const factActive = dataSource === 'facturacion';
  const factHeader = factActive
    ? '<th class="num" title="Fuente ACTIVA del calculo">Facturado ✓</th>'
    : '<th class="num" style="color:var(--muted);" title="Solo informativo">Facturado</th>';
  const cobHeader = !factActive
    ? '<th class="num" title="Fuente ACTIVA del calculo">Cobrado ✓</th>'
    : '<th class="num" style="color:var(--muted);" title="Solo informativo">Cobrado</th>';
  const head = `<tr>
    <th>Mes</th>
    ${factHeader}
    ${cobHeader}
    <th class="num">Margen bruto</th>
    ${showCosts ? '<th class="num">Costos empresa</th>' : ''}
    <th class="num">Margen op.</th>
    <th class="num">Excedente</th>
    <th class="num">Var. prop.</th>
    <th class="num">Nom. actual</th>
    <th class="num">Nom. propuesta</th>
    <th class="num">% prop</th>
    <th class="num">Δ vs actual</th>
  </tr>`;
  const colspan = (showCosts ? 11 : 10) + 1; // +1 por la columna extra
  const body = rows.map(r => {
    const cls = r.overCapProp ? 'over-cap-prop' : (r.excedente > 0 ? 'ex-pos' : '');
    const deltaCls = r.delta > 0 ? 'delta-pos' : (r.delta < 0 ? 'delta-neg' : '');
    const deltaBreak = r.deltaRaise !== 0 && r.deltaVar !== 0
      ? `<div class="delta-breakdown">↑fijo ${fmtSignedUsd(r.deltaRaise)} · var ${fmtSignedUsd(r.deltaVar)}</div>`
      : '';
    const costoEmp = r.costoFijoMes + r.costoVarMes;
    // La fuente activa en negrita, la inactiva en gris tenue
    const factCell = factActive
      ? `<td class="num"><b>${fmtUsd(r.revFact)}</b></td>`
      : `<td class="num" style="color:var(--muted);">${fmtUsd(r.revFact)}</td>`;
    const cobCell = !factActive
      ? `<td class="num"><b>${fmtUsd(r.revCob)}</b></td>`
      : `<td class="num" style="color:var(--muted);">${fmtUsd(r.revCob)}</td>`;
    return `<tr class="${cls}">
      <td>${fmtMes(r.mes)}</td>
      ${factCell}
      ${cobCell}
      <td class="num" style="color:var(--muted);">${fmtUsd(r.margenBruto)}</td>
      ${showCosts ? `<td class="num" style="color:var(--muted);">${fmtUsd(costoEmp)}</td>` : ''}
      <td class="num">${fmtUsd(r.margenOp)}</td>
      <td class="num" style="color:var(--success);">${fmtUsd(r.excedente)}</td>
      <td class="num">${r.poolProp > 0 ? fmtUsd(r.poolProp) : '—'}</td>
      <td class="num">${fmtUsd(r.nominaAct)}</td>
      <td class="num"><b>${fmtUsd(r.nominaProp)}</b></td>
      <td class="num">${fmtPct(r.pctProp)}</td>
      <td class="num ${deltaCls}"><b>${fmtSignedUsd(r.delta)}</b>${deltaBreak}</td>
    </tr>`;
  }).join('');
  const foot = `<tfoot><tr>
    <td colspan="${colspan}" class="footnote">
      Base: <b>${factActive ? 'Facturado' : 'Cobrado'}</b> · target: ${fmtUsd(target)}/mes · tope: ${fmtPct(cap)} · verde = excedente · rojo = supera tope
    </td>
  </tr></tfoot>`;
  document.getElementById('tbl-monthly').innerHTML = head + body + foot;
}

// -------------------- Annual projection --------------------
function renderAnnual(result) {
  const { rows, act, prop } = result;
  const { costoFijoEmp, costoVarPct, ownerDraw, payrollTaxPct, dataSource } = result;
  const last12 = rows.slice(-12);
  const totRev = last12.reduce((a,r)=>a+r.rev,0);
  const totCmv = last12.reduce((a,r)=>a+r.cmvUsd,0);
  const totMgBruto = last12.reduce((a,r)=>a+r.margenBruto,0);
  const totCostoFijoEmp = costoFijoEmp * 12;
  const totCostoVarEmp = last12.reduce((a,r)=>a+r.costoVarMes,0);
  const totOwnerDraw = ownerDraw * 12;
  const totMgOp = last12.reduce((a,r)=>a+r.margenOp,0);
  // Pools SIN cargas sociales (base)
  const totPoolActBase  = last12.reduce((a,r)=>a+r.poolAct, 0)  / (1 + payrollTaxPct);
  const totPoolPropBase = last12.reduce((a,r)=>a+r.poolProp,0) / (1 + payrollTaxPct);

  // Nomina sin cargas sociales (base)
  const fijoAct12  = act.fijo * 12;
  const aguiAct    = act.fijo * act.aguinaldo_meses;
  const baseNomAct = fijoAct12 + aguiAct + totPoolActBase;

  const fijoProp12  = prop.fijo * 12;
  const aguiProp    = prop.fijo * prop.aguinaldo_meses;
  const baseNomProp = fijoProp12 + aguiProp + totPoolPropBase;

  // Cargas sociales
  const ccssAct  = baseNomAct  * payrollTaxPct;
  const ccssProp = baseNomProp * payrollTaxPct;

  const totNomAct  = baseNomAct  + ccssAct;
  const totNomProp = baseNomProp + ccssProp;

  const deltaNom = totNomProp - totNomAct;
  const utilAct  = totMgOp - totNomAct;
  const utilProp = totMgOp - totNomProp;
  const pctActAnual  = totRev > 0 ? 100*totNomAct  / totRev : 0;
  const pctPropAnual = totRev > 0 ? 100*totNomProp / totRev : 0;

  const row = (label, a, b, d, className = '') => `
    <tr class="${className}">
      <td>${label}</td>
      <td class="num">${fmtUsd(a)}</td>
      <td class="num">${fmtUsd(b)}</td>
      <td class="num ${d > 0 ? 'delta-pos' : d < 0 ? 'delta-neg' : ''}">${d === 0 ? '—' : fmtSignedUsd(d)}</td>
    </tr>
  `;
  const sectionHeader = label => `<tr><td colspan="4" style="padding-top:10px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">${label}</td></tr>`;

  const sourceLabel = dataSource === 'cobranza' ? 'Cobranza neta' : 'Facturacion neta';

  document.getElementById('tbl-annual').innerHTML = `
    <tr>
      <th>Metrica (12 meses cerrados)</th>
      <th class="num">Actual</th>
      <th class="num">Propuesta</th>
      <th class="num">Δ</th>
    </tr>
    ${sectionHeader('Ingresos y costos de mercaderia')}
    ${row(sourceLabel, totRev, totRev, 0)}
    ${row(`(−) CMV (${(result.cmv*100).toFixed(1)}%)`, -totCmv, -totCmv, 0)}
    ${row('= Margen bruto', totMgBruto, totMgBruto, 0)}
    ${sectionHeader('Costos operativos empresa')}
    ${row(`(−) Costos fijos empresa (12 × $${costoFijoEmp.toLocaleString()})`, -totCostoFijoEmp, -totCostoFijoEmp, 0)}
    ${row(`(−) Costos variables (${(costoVarPct*100).toFixed(1)}% × venta)`, -totCostoVarEmp, -totCostoVarEmp, 0)}
    ${row(`(−) Retiros del socio (12 × $${ownerDraw.toLocaleString()})`, -totOwnerDraw, -totOwnerDraw, 0)}
    ${row('= Margen operativo pre-nomina', totMgOp, totMgOp, 0, 'ex-pos')}
    ${sectionHeader('Nomina base (bruta)')}
    ${row('Fijo anual (12 meses)', fijoAct12, fijoProp12, fijoProp12 - fijoAct12)}
    ${row(`Aguinaldo (${act.aguinaldo_meses} / ${prop.aguinaldo_meses} meses)`, aguiAct, aguiProp, aguiProp - aguiAct)}
    ${row(`Variable anual ${act.pays_variable ? '(actual SI paga)' : '(actual no paga)'}`, totPoolActBase, totPoolPropBase, totPoolPropBase - totPoolActBase)}
    ${row('Subtotal nomina base', baseNomAct, baseNomProp, baseNomProp - baseNomAct)}
    ${sectionHeader('Cargas sociales y costo total empresa')}
    ${row(`(+) Cargas sociales (${(payrollTaxPct*100).toFixed(0)}%)`, ccssAct, ccssProp, ccssProp - ccssAct)}
    ${row('(−) COSTO TOTAL NOMINA EMPRESA', -totNomAct, -totNomProp, -deltaNom)}
    ${sectionHeader('Resultado')}
    ${row('= Utilidad / margen final', utilAct, utilProp, utilProp - utilAct, 'ex-pos')}
    <tr>
      <td>% nomina sobre ${dataSource === 'cobranza' ? 'cobranza' : 'facturacion'}</td>
      <td class="num">${pctActAnual.toFixed(1)}%</td>
      <td class="num">${pctPropAnual.toFixed(1)}%</td>
      <td class="num">${(pctPropAnual - pctActAnual >= 0 ? '+' : '')}${(pctPropAnual - pctActAnual).toFixed(1)} pp</td>
    </tr>
  `;
}

// -------------------- Recommendation --------------------
function renderRecommendation(result) {
  const { rows, cap, cmv, act, prop, periods, frequency, freqN, payrollTaxPct, capPerson } = result;
  if (!prop.pays_variable) {
    document.getElementById('recommendation').innerHTML =
      `<b>ℹ La propuesta actualmente NO paga variable.</b> Marca el checkbox "Paga variable" en la card de Propuesta para activar el calculo del pool.`;
    return;
  }
  if (prop.participants === 0) {
    document.getElementById('recommendation').innerHTML =
      `<b>ℹ Ningun rol de la propuesta tiene el checkbox "Participa" marcado.</b> Marca al menos uno para activar el variable.`;
    return;
  }

  // Busca el periodo con mayor excedente (el "pico" en terminos de variable pagado)
  if (!periods || periods.length === 0) return;
  const peakPeriod = periods.reduce((a,p) => p.excedente > a.excedente ? p : a, periods[0]);
  if (peakPeriod.excedente <= 0) {
    document.getElementById('recommendation').innerHTML =
      `<b>ℹ Con la combinacion actual (CMV ${(cmv*100).toFixed(1)}% + costos empresa) ningun periodo genera excedente.</b> Baja el CMV, baja los costos operativos o amplia la ventana de target.`;
    return;
  }

  // El "mes pico de caja" = el mes donde cae el pago del periodo pico
  const peakRow = rows.find(r => r.periodInfo && r.periodInfo.isLast && r.mes === peakPeriod.endMes) || rows[rows.length-1];
  const peakRev = peakRow.rev;

  // El pool del periodo pico se paga en el mes endMes.
  // Calculamos maxPool como el espacio que queda bajo el tope % fact en ese mes.
  const peakNominaFijoConCargas = prop.fijo * (1 + payrollTaxPct);
  const maxPoolConCargas = cap * peakRev - peakNominaFijoConCargas;
  const maxPoolBase = maxPoolConCargas / (1 + payrollTaxPct);

  if (maxPoolBase <= 0) {
    document.getElementById('recommendation').innerHTML = `
      <div>
        <div style="font-size:12px;color:var(--muted);">RECOMENDACION AUTOMATICA</div>
        <div style="font-size:15px;margin-top:4px;color:var(--danger);">
          <b>⚠ Con este fijo propuesto (${fmtUsd(prop.fijo)}) + cargas sociales (${(payrollTaxPct*100).toFixed(0)}%) no queda margen para variable en el mes pico.</b>
        </div>
        <div class="footnote">
          Fijo con cargas = ${fmtUsd(peakNominaFijoConCargas)}, ya es ${(100*peakNominaFijoConCargas/peakRev).toFixed(1)}% del mes pico (${fmtUsd(peakRev)}).
          Tope: ${(cap*100).toFixed(0)}% = ${fmtUsd(cap*peakRev)}.
          Subi el tope, baja el fijo o reduci las cargas modeladas.
        </div>
      </div>
    `;
    return;
  }

  // pool base = excedente * pct * participants (distribucion equitativa)
  // max pct = maxPoolBase / (excedente * participants)
  const maxPct = peakPeriod.excedente * prop.participants > 0
    ? maxPoolBase / (peakPeriod.excedente * prop.participants)
    : 0;
  const maxPctPct = maxPct * 100;
  const current = parseFloat(document.getElementById('sl-pct').value);
  const badge = current <= maxPctPct
    ? '<span class="tag green">DENTRO DEL TOPE</span>'
    : '<span class="tag red">EXCEDE TOPE</span>';

  // Con el % actual
  const curPct = current / 100;
  const curPerPersonRaw = peakPeriod.excedente * curPct;
  const avgSalParticipants = prop.rows.filter(r => r.participates).reduce((a,r)=>a + r.count*r.salary, 0) / prop.participants;
  const capPerPerson = capPerson * avgSalParticipants * peakPeriod.months;
  const curPerPerson = Math.min(curPerPersonRaw, capPerPerson);
  const capActive = curPerPersonRaw > capPerPerson;
  const curPool = curPerPerson * prop.participants;

  // Desglose de quienes participan
  const participantRoles = prop.rows
    .filter(r => r.participates && r.count > 0)
    .map(r => `<b>${r.count}× ${r.name || 'rol'}</b> ($${r.salary}/mes)`)
    .join(' · ') || '<i>ningun rol con checkbox Participa marcado</i>';

  const freqLabel = { mensual: 'por mes', trimestral: 'por trimestre', semestral: 'por semestre', anual: 'por año' }[frequency];

  document.getElementById('recommendation').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:280px;">
        <div style="font-size:12px;color:var(--muted);">RECOMENDACION AUTOMATICA (periodo pico: ${fmtMes(peakPeriod.startMes)} → ${fmtMes(peakPeriod.endMes)}, pago ${freqLabel})</div>
        <div style="font-size:16px;margin-top:4px;">
          Maximo % variable que cumple el tope de <b>${(cap*100).toFixed(0)}%</b>:
          <b style="color:var(--success);font-size:20px;">${maxPctPct.toFixed(2)}%</b>
        </div>
        <div class="footnote" style="margin-top:8px;">
          Periodo pico (${peakPeriod.months} meses): excedente <b>${fmtUsd(peakPeriod.excedente)}</b> ·
          participantes en variable: <b>${prop.participants}</b> ·
          con slider actual (${current.toFixed(2)}%): cada participante cobra <b>${fmtUsd(curPerPerson)}</b>${capActive ? ' <span class="tag warn">CAP ACTIVO</span>' : ''} · pool total <b>${fmtUsd(curPool)}</b>
        </div>
        <div class="footnote" style="margin-top:6px;">
          <b>Participan del variable (distribucion equitativa):</b> ${participantRoles}
        </div>
        <div class="footnote" style="margin-top:6px;">
          Fijo mensual: ${fmtUsd(act.fijo)} → ${fmtUsd(prop.fijo)} (${fmtSignedUsd(prop.fijo-act.fijo)}) · Cargas sociales modeladas: ${(payrollTaxPct*100).toFixed(0)}%
          · Cap individual: ${(capPerson*100).toFixed(0)}% del sueldo mensual × ${peakPeriod.months} meses = ${fmtUsd(capPerPerson)} max por persona
        </div>
      </div>
      <div>${badge}</div>
    </div>
  `;
}

// -------------------- Clients & products --------------------
function renderClients() {
  const rows = DATA.top_clients;
  const head = `<tr><th>#</th><th>Cliente</th><th class="num">Facturas</th><th class="num">USD 12m</th><th class="num">% tot.</th></tr>`;
  const total12 = DATA.summary.total_sales_12m;
  const body = rows.map((r,i) => {
    const pct = 100*(r.net_usd||0)/total12;
    const badge = pct > 20 ? '<span class="tag red">ALTO</span>' :
                  pct > 10 ? '<span class="tag warn">MEDIO</span>' : '';
    return `<tr>
      <td>${i+1}</td>
      <td>${(r.cliente||'').slice(0,40)} ${badge}</td>
      <td class="num">${r.facturas}</td>
      <td class="num">${fmtUsd(r.net_usd||0)}</td>
      <td class="num">${pct.toFixed(1)}%</td>
    </tr>`;
  }).join('');
  document.getElementById('tbl-clients').innerHTML = head + body;

  const note = DATA.summary;
  let warning = '';
  if (note.top1_pct > 20) warning = `<span class="tag red">⚠ Top-1 = ${note.top1_pct}% (alta dependencia)</span> `;
  else if (note.top1_pct > 15) warning = `<span class="tag warn">Top-1 = ${note.top1_pct}%</span> `;
  document.getElementById('concentration-note').innerHTML =
    warning + `Top-5 = ${note.top5_pct}% · Top-10 = ${note.top10_pct}% de la facturacion 12m`;
}

function renderProducts() {
  const rows = DATA.top_products;
  const head = `<tr><th>#</th><th>Codigo</th><th>Descripcion</th><th class="num">Uds.</th><th class="num">USD 12m</th></tr>`;
  const body = rows.map((r,i) =>
    `<tr>
      <td>${i+1}</td>
      <td><b>${r.code||''}</b></td>
      <td>${(r.descripcion||'').slice(0,50)}</td>
      <td class="num">${Math.round(r.unidades||0).toLocaleString()}</td>
      <td class="num">${fmtUsd(r.facturado_usd||0)}</td>
    </tr>`
  ).join('');
  document.getElementById('tbl-products').innerHTML = head + body;
}

// -------------------- Charts --------------------
let charts = {};
function destroyCharts() { Object.values(charts).forEach(c => c && c.destroy()); charts = {}; }

function renderCharts(result) {
  destroyCharts();
  const { rows, cap, target, act, prop } = result;
  const labels = rows.map(r => fmtMes(r.mes));
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const gridCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textCol = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
  const baseOpts = {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ labels:{ color:textCol, font:{size:11} } } },
    scales:{
      x:{ ticks:{ color:textCol, font:{size:10} }, grid:{ display:false } },
      y:{ ticks:{ color:textCol, callback:v=>'$'+v.toLocaleString() }, grid:{ color:gridCol } }
    }
  };

  // 1. Stacked propuesta (fijo + variable) + linea baseline fijo actual
  charts.stack = new Chart(document.getElementById('c-stack'), {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'Fijo propuesto', data: rows.map(()=>prop.fijo), backgroundColor:'#3b82f6' },
        { label:'Variable propuesta', data: rows.map(r => r.poolProp), backgroundColor:'#10b981' },
        { label:'Fijo actual', data: rows.map(()=>act.fijo), type:'line', borderColor:'#94a3b8',
          borderDash:[5,5], backgroundColor:'transparent', pointRadius:0, borderWidth:2 },
      ]
    },
    options: { ...baseOpts, scales:{ x:{...baseOpts.scales.x, stacked:true}, y:{...baseOpts.scales.y, stacked:true} } }
  });

  // 2. % nomina (actual vs propuesta vs tope)
  charts.pct = new Chart(document.getElementById('c-pct'), {
    type:'line',
    data:{
      labels,
      datasets:[
        { label:'% actual', data: rows.map(r => +(r.pctAct*100).toFixed(2)),
          borderColor:'#94a3b8', backgroundColor:'transparent', tension:0.3, pointRadius:2, borderWidth:2 },
        { label:'% propuesta', data: rows.map(r => +(r.pctProp*100).toFixed(2)),
          borderColor:'#a855f7', backgroundColor:'rgba(168,85,247,0.15)', fill:true, tension:0.3, pointRadius:3, borderWidth:2 },
        { label:'Tope', data: rows.map(()=>+(cap*100)), borderColor:'#ef4444',
          borderDash:[6,4], pointRadius:0, borderWidth:1.5 },
      ]
    },
    options: { ...baseOpts,
      scales:{
        ...baseOpts.scales,
        y:{ ...baseOpts.scales.y, ticks:{ ...baseOpts.scales.y.ticks, callback:v=>v+'%' }, min:0 }
      }
    }
  });

  // 3. Facturacion vs target margen
  charts.rev = new Chart(document.getElementById('c-rev'), {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'Facturacion', data: rows.map(r=>Math.round(r.rev)), backgroundColor:'#3b82f6' },
        { label:'Target margen', data: rows.map(()=>Math.round(target)), type:'line',
          borderColor:'#f59e0b', backgroundColor:'transparent', borderDash:[6,4], pointRadius:0, borderWidth:2 },
      ]
    },
    options: baseOpts
  });

  // 4. Delta mensual apilado (fijo + variable)
  charts.delta = new Chart(document.getElementById('c-delta'), {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'Δ fijo (aumento)',   data: rows.map(r=>Math.round(r.deltaRaise)), backgroundColor:'#3b82f6' },
        { label:'Δ variable',         data: rows.map(r=>Math.round(r.deltaVar)),   backgroundColor:'#10b981' },
      ]
    },
    options: { ...baseOpts, scales:{ x:{...baseOpts.scales.x, stacked:true}, y:{...baseOpts.scales.y, stacked:true} } }
  });
}

// -------------------- Orchestrator --------------------
function render() {
  const result = calc();
  renderKpis(result);
  renderUnitEconomics(result);
  renderMonthly(result);
  renderAnnual(result);
  renderRecommendation(result);
  renderCharts(result);
  // Persist sliders + company costs + variable config
  try {
    localStorage.setItem(LS_SLIDERS, JSON.stringify({
      cmv:         document.getElementById('sl-cmv').value,
      pct:         document.getElementById('sl-pct').value,
      window:      document.getElementById('sl-window').value,
      cap:         document.getElementById('sl-cap').value,
      capPerson:   document.getElementById('sl-cap-person').value,
      costoFijo:   document.getElementById('costo-fijo').value,
      costoVarPct: document.getElementById('costo-var-pct').value,
      ownerDraw:   document.getElementById('owner-draw').value,
      payrollTax:  document.getElementById('payroll-tax').value,
      frequency:   document.getElementById('var-frequency').value,
      dataSource:  document.getElementById('data-source').value,
    }));
  } catch(e) {}
}

// Restore slider + company costs + variable config state
try {
  const saved = JSON.parse(localStorage.getItem(LS_SLIDERS) || '{}');
  if (saved.cmv        !== undefined) document.getElementById('sl-cmv').value         = saved.cmv;
  if (saved.pct        !== undefined) document.getElementById('sl-pct').value         = saved.pct;
  if (saved.window     !== undefined) document.getElementById('sl-window').value      = saved.window;
  if (saved.cap        !== undefined) document.getElementById('sl-cap').value         = saved.cap;
  if (saved.capPerson  !== undefined) document.getElementById('sl-cap-person').value  = saved.capPerson;
  if (saved.costoFijo  !== undefined) document.getElementById('costo-fijo').value     = saved.costoFijo;
  if (saved.costoVarPct!== undefined) document.getElementById('costo-var-pct').value  = saved.costoVarPct;
  if (saved.ownerDraw  !== undefined) document.getElementById('owner-draw').value     = saved.ownerDraw;
  if (saved.payrollTax !== undefined) document.getElementById('payroll-tax').value    = saved.payrollTax;
  if (saved.frequency  !== undefined) document.getElementById('var-frequency').value  = saved.frequency;
  if (saved.dataSource !== undefined) document.getElementById('data-source').value    = saved.dataSource;
} catch(e) {}

['sl-cmv','sl-pct','sl-window','sl-cap','sl-cap-person','costo-fijo','costo-var-pct','owner-draw','payroll-tax'].forEach(id => {
  document.getElementById(id).addEventListener('input', render);
});
['var-frequency','data-source'].forEach(id => {
  document.getElementById(id).addEventListener('change', render);
});

document.getElementById('btn-reset-costs').addEventListener('click', resetCompanyCosts);

renderProfileCards();
renderAnchors();
renderClients();
renderProducts();
render();
</script>
</body>
</html>
"""


def main():
    print(f"[1/3] Conectando a {DATABASE_URL.split('@')[-1]}")
    raw = fetch_all()
    print(f"      monthly={len(raw['monthly'])}  clients={len(raw['top_clients'])}  products={len(raw['top_products'])}")

    print("[2/3] Post-procesando...")
    data = build_derived(raw)
    s = data["summary"]
    print(f"      promedio 12m = ${s['avg_net_12m']:,} USD | mejor mes {s['max_month']['mes']} = ${s['max_month']['usd']:,}")
    print(f"      concentracion: top1={s['top1_pct']}% top5={s['top5_pct']}% top10={s['top10_pct']}%")
    act_tot  = profile_total(DEFAULT_PROFILES['actual'])
    prop_tot = profile_total(DEFAULT_PROFILES['propuesta'])
    print(f"      nomina actual {act_tot} -> propuesta {prop_tot} (+{prop_tot-act_tot}/mes)")
    ca = data["cost_anchors"]
    print(f"      anclas CMV: FOB {ca['cmv_fob_pct']}% / CIF {ca['cmv_cif_pct']}% / Landed {ca['cmv_landed_pct']}%")
    print(f"      cobertura: {ca['cobertura_pct']}% ({ca['articulos_con_costo']}/{ca['articulos_facturados']} articulos, {ca['proformas_cargadas']} proformas) -> calidad: {ca['calidad']}")
    # Resumen de cobranzas
    monthly = data["monthly"]
    last12 = monthly[-12:]
    cobranza_12m = sum(m.get("cobranza_usd", 0) for m in last12)
    facturacion_12m = sum(m.get("net_usd", 0) for m in last12)
    print(f"      facturacion 12m: ${facturacion_12m:,.0f} USD | cobranza 12m: ${cobranza_12m:,.0f} USD")
    print(f"      config default: freq={DEFAULT_VARIABLE_CONFIG['frequency']}, cargas sociales={DEFAULT_COMPANY_COSTS['payroll_tax_pct']}%, cap/persona={DEFAULT_VARIABLE_CONFIG['cap_pct_salary']}%, source={DEFAULT_VARIABLE_CONFIG['source']}")

    JSON_OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"      json -> {JSON_OUT}")

    print("[3/3] Generando HTML...")
    json_inline = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = HTML_TEMPLATE.replace("__DATA_JSON__", json_inline)
    HTML_OUT.write_text(html, encoding="utf-8")
    print(f"      html -> {HTML_OUT}")
    print("\n[OK] Listo. Abri el HTML en el browser:")
    print(f"  file:///{str(HTML_OUT).replace(chr(92), '/')}")


if __name__ == "__main__":
    main()
