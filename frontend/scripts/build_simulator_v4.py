"""
build_simulator_v4.py

Generates a self-contained HTML variable pay simulator for DIALFA (v4).
Simplified UI (~600 lines HTML+CSS+JS), dark theme, Chart.js via CDN.

Usage:
    python scripts/build_simulator_v4.py
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
# Configuration (reused from v3)
# -------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

HTML_OUT = OUTPUT_DIR / "dialfa_variable_pay_simulator_v4.html"

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

# -------------------------------------------------------------------
# Default profiles, costs, variable config (same as v3)
# -------------------------------------------------------------------
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

DEFAULT_COMPANY_COSTS = {
    "fixed_usd_month":    12800,
    "variable_pct_sales": 8.0,
    "payroll_tax_pct":    40,
    "owner_draw_usd":     15800,
}

DEFAULT_VARIABLE_CONFIG = {
    "frequency":       "trimestral",
    "cap_pct_salary":  50,
    "source":          "cobranza",
}

def profile_total(p):
    return sum(r["count"] * r["salary"] for r in p["rows"])

def profile_participants(p):
    return sum(r["count"] for r in p["rows"] if r.get("participates"))

PO_ANCHORS = {
    "venta_usd_total":   539_421.0,
    "fob_usd_total":     127_977.0,
    "cif_usd_total":     191_966.0,
    "landed_usd_total":  230_360.0,
}
PO_ANCHORS["cmv_fob_pct"]    = round(100 * PO_ANCHORS["fob_usd_total"]    / PO_ANCHORS["venta_usd_total"], 1)
PO_ANCHORS["cmv_cif_pct"]    = round(100 * PO_ANCHORS["cif_usd_total"]    / PO_ANCHORS["venta_usd_total"], 1)
PO_ANCHORS["cmv_landed_pct"] = round(100 * PO_ANCHORS["landed_usd_total"] / PO_ANCHORS["venta_usd_total"], 1)

# -------------------------------------------------------------------
# SQL (same as v3, minus Q_STOCK_VALUATION)
# -------------------------------------------------------------------
Q_MONTHLY_COLLECTIONS = """
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
  COUNT(*) AS n,
  SUM(st.payment_amount) AS total_ars,
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
    finally:
        conn.close()

    def cast(row):
        return {k: (float(v) if isinstance(v, Decimal) else v) for k, v in row.items()}

    return {
        "monthly":      [cast(r) for r in monthly],
        "collections":  [cast(r) for r in collections],
        "top_clients":  [cast(r) for r in top_clients],
        "top_products": [cast(r) for r in top_products],
        "cost_stats":   cast(cost_stats),
    }


def compute_anchors(cost_stats):
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

    current_month = date.today().strftime("%Y-%m")
    monthly = [m for m in monthly if m["mes"] < current_month]

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

    total_sales_12m = sum(m["net_usd"] for m in last12)
    top1  = raw["top_clients"][0]["net_usd"] if raw["top_clients"] else 0
    top5  = sum(c["net_usd"] for c in raw["top_clients"][:5])  if raw["top_clients"] else 0
    top10 = sum(c["net_usd"] for c in raw["top_clients"][:10]) if raw["top_clients"] else 0

    def pct(part): return round(100 * part / total_sales_12m, 1) if total_sales_12m else 0

    # Cobranza avg 12m
    avg_cob = sum(m.get("cobranza_usd", 0) for m in last12) / max(len(last12), 1)

    return {
        "monthly": monthly,
        "top_clients": raw["top_clients"],
        "top_products": raw["top_products"],
        "summary": {
            "months_count":     len(monthly),
            "avg_net_12m":      round(avg_net),
            "avg_total_12m":    round(avg_total),
            "avg_cob_12m":      round(avg_cob),
            "max_month":        {"mes": max_m["mes"], "usd": round(max_m["net_usd"])} if max_m else None,
            "min_month":        {"mes": min_m["mes"], "usd": round(min_m["net_usd"])} if min_m else None,
            "total_sales_12m":  round(total_sales_12m),
            "top1_pct":         pct(top1),
            "top5_pct":         pct(top5),
            "top10_pct":        pct(top10),
        },
        "po_anchors": PO_ANCHORS,
        "cost_anchors": compute_anchors(raw.get("cost_stats", {})),
        "default_profiles": DEFAULT_PROFILES,
        "default_company_costs": DEFAULT_COMPANY_COSTS,
        "default_variable_config": DEFAULT_VARIABLE_CONFIG,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
    }


# -------------------------------------------------------------------
# HTML Template v4
# -------------------------------------------------------------------
HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DIALFA - Simulador Variable v4</title>
<style>
:root{--bg:#0f172a;--card:#1e293b;--card2:#0b1220;--border:#334155;--text:#e2e8f0;--muted:#94a3b8;--accent:#3b82f6;--success:#10b981;--warn:#f59e0b;--danger:#ef4444;}
*{box-sizing:border-box;margin:0;}
body{background:var(--bg);color:var(--text);font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:16px;font-size:13px;}
.wrap{max-width:1400px;margin:0 auto;}
h1{font-size:20px;margin-bottom:2px;}
h2{font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin:20px 0 8px;}
.sub{color:var(--muted);font-size:11px;margin-bottom:16px;}

/* KPIs */
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px;}
@media(max-width:900px){.kpis{grid-template-columns:repeat(3,1fr);}}
.kpi{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;}
.kpi-l{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;}
.kpi-v{font-size:20px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums;}
.kpi-s{font-size:10px;color:var(--muted);margin-top:1px;}

/* Controls card */
.ctrl{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px;}
@media(max-width:900px){.ctrl{grid-template-columns:1fr;}}
.ctrl-left,.ctrl-right{display:flex;flex-direction:column;gap:8px;}
.profile-block{margin-bottom:6px;}
.profile-block h3{font-size:11px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;display:flex;align-items:center;gap:6px;}
.profile-block h3 .dot-act{color:#64748b;}
.profile-block h3 .dot-prop{color:var(--accent);}
.ptbl{width:100%;border-collapse:collapse;font-size:11px;}
.ptbl th{text-align:left;color:var(--muted);font-size:9px;text-transform:uppercase;padding:2px 4px;border-bottom:1px solid var(--border);}
.ptbl th.c{text-align:center;}
.ptbl td{padding:3px 4px;}
.ptbl input[type=text],.ptbl input[type=number]{width:100%;padding:3px 5px;background:var(--card2);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:11px;}
.ptbl input[type=text]{min-width:70px;}
.ptbl input[type=number]{width:60px;}
.ptbl input[type=checkbox]{cursor:pointer;}
.ptbl .act-col{text-align:center;}
.btn-rm{background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:12px;padding:1px 5px;line-height:1;}
.btn-rm:hover{color:var(--danger);border-color:var(--danger);}
.btn-add{background:transparent;color:var(--accent);border:1px dashed var(--accent);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:10px;margin-top:4px;}
.btn-add:hover{background:rgba(59,130,246,.1);}
.pmeta{display:flex;gap:10px;align-items:center;font-size:10px;color:var(--muted);margin-top:4px;flex-wrap:wrap;}
.pmeta label{display:flex;align-items:center;gap:4px;}
.pmeta input[type=number]{width:45px;padding:2px 4px;background:var(--card2);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:10px;}
.pmeta input[type=checkbox]{cursor:pointer;}
.ptotal{font-size:12px;font-weight:600;margin-top:4px;}
.ptotal small{color:var(--muted);font-weight:400;font-size:10px;}

/* Right column controls */
.cr{display:flex;align-items:center;gap:8px;margin:4px 0;}
.cr label{font-size:11px;color:var(--muted);min-width:130px;flex-shrink:0;}
.cr input[type=range]{flex:1;min-width:80px;}
.cr .v{font-size:12px;font-weight:600;min-width:50px;text-align:right;font-variant-numeric:tabular-nums;}
.cr select,.cr input[type=number]{padding:4px 6px;background:var(--card2);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:11px;}
.cr select{flex:1;}
.cr input[type=number]{width:80px;}
.anchors{display:flex;gap:5px;flex-wrap:wrap;margin:2px 0 6px;}
.anc{background:rgba(59,130,246,.1);border:1px solid var(--accent);color:var(--accent);padding:2px 6px;border-radius:4px;cursor:pointer;font-size:10px;}
.anc:hover{background:rgba(59,130,246,.25);}
.btn-reset{background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:10px;}
.btn-reset:hover{color:var(--text);border-color:var(--text);}
.sep{border-top:1px solid var(--border);margin:6px 0;}

/* Recommendation banner */
.rec{background:linear-gradient(135deg,rgba(59,130,246,.1),rgba(16,185,129,.1));border:1px solid var(--accent);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12px;line-height:1.6;}
.rec b{color:var(--accent);}

/* Tables */
.card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px;}
table{width:100%;border-collapse:collapse;font-size:11px;}
th,td{padding:4px 6px;text-align:left;border-bottom:1px solid var(--border);}
th{color:var(--muted);font-weight:500;font-size:9px;text-transform:uppercase;position:sticky;top:0;background:var(--card);}
.r{text-align:right;font-variant-numeric:tabular-nums;}
.pos{color:var(--success);}
.neg{color:var(--danger);}
.scroll-x{overflow-x:auto;max-height:400px;overflow-y:auto;}

/* Charts */
.charts{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;}
@media(max-width:900px){.charts{grid-template-columns:1fr;}}
.chart-wrap{position:relative;height:260px;}

/* Side tables */
.side{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
@media(max-width:900px){.side{grid-template-columns:1fr;}}

.footer{margin-top:24px;padding-top:10px;border-top:1px solid var(--border);color:var(--muted);font-size:10px;text-align:center;}
</style>
</head>
<body>
<div class="wrap">

<!-- S1: Header + KPIs -->
<h1>DIALFA - Simulador Variable</h1>
<div class="sub">v4 | datos reales 18m | generado <span id="gen"></span></div>
<div class="kpis" id="kpis"></div>

<!-- S2: Controls -->
<h2>Configuracion</h2>
<div class="ctrl">
  <div class="ctrl-left">
    <div class="profile-block" id="pb-actual"></div>
    <div class="profile-block" id="pb-propuesta"></div>
  </div>
  <div class="ctrl-right">
    <div class="cr"><label>CMV (% s/fact.)</label><input type="range" id="sl-cmv" min="10" max="60" step="0.5" value="32.4"><span class="v" id="o-cmv">32.4%</span></div>
    <div class="anchors" id="anchors"></div>
    <div class="sep"></div>
    <div class="cr"><label>Costos fijos (USD)</label><input type="number" id="i-fijo" min="0" step="100" value="12800"></div>
    <div class="cr"><label>Variables (%)</label><input type="number" id="i-var" min="0" max="50" step="0.5" value="8"></div>
    <div class="cr"><label>Retiros socio (USD)</label><input type="number" id="i-draw" min="0" step="100" value="15800"></div>
    <div class="cr"><label>Cargas sociales (%)</label><input type="number" id="i-tax" min="0" max="100" step="1" value="40"></div>
    <div class="sep"></div>
    <div class="cr"><label>% variable</label><input type="range" id="sl-pct" min="1" max="30" step="0.25" value="5"><span class="v" id="o-pct">5.00%</span></div>
    <div class="cr"><label>Cap por persona (%)</label><input type="range" id="sl-cap-p" min="0" max="200" step="5" value="50"><span class="v" id="o-cap-p">50%</span></div>
    <div class="cr"><label>Frecuencia</label><select id="sel-freq"><option value="mensual">Mensual</option><option value="trimestral" selected>Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option></select></div>
    <div class="cr"><label>Fuente</label><select id="sel-src"><option value="facturacion">Facturacion</option><option value="cobranza" selected>Cobranza</option></select></div>
    <div class="sep"></div>
    <div class="cr" style="background:rgba(16,185,129,0.08);padding:6px 8px;border-radius:6px;border:1px dashed var(--success);">
      <label style="color:var(--success);">Revenue proyectado (USD/mes)</label>
      <input type="number" id="i-rev-proj" min="0" step="1000" value="0" placeholder="0 = usar datos reales">
      <span class="v" id="o-rev-proj" style="font-size:10px;color:var(--muted);min-width:90px;">0 = real</span>
    </div>
    <div class="cr"><label>Ventana target</label><input type="range" id="sl-win" min="3" max="18" step="1" value="12"><span class="v" id="o-win">12</span></div>
    <div class="cr"><label>Tope nomina (%)</label><input type="range" id="sl-cap" min="20" max="60" step="0.5" value="30"><span class="v" id="o-cap">30%</span></div>
    <div style="margin-top:6px;display:flex;gap:6px;">
      <button class="btn-reset" id="btn-reset-all">Reset todo</button>
    </div>
  </div>
</div>

<!-- S3: Recommendation -->
<div class="rec" id="rec"></div>

<!-- S4: P&L Annual -->
<h2>P&L Anual (12m reales)</h2>
<div class="card"><table id="tbl-pl"></table></div>

<!-- S5: Monthly -->
<h2>Tabla mensual</h2>
<div class="card scroll-x"><table id="tbl-m"></table></div>

<!-- S6: Charts -->
<div class="charts">
  <div class="card"><h2 style="margin-top:0;">Nomina propuesta (fijo + variable)</h2><div class="chart-wrap"><canvas id="c1"></canvas></div></div>
  <div class="card"><h2 style="margin-top:0;">% nomina s/facturacion</h2><div class="chart-wrap"><canvas id="c2"></canvas></div></div>
</div>

<!-- S7: Top clients + products -->
<div class="side">
  <div class="card"><h2 style="margin-top:0;">Top 20 clientes (12m)</h2><div class="scroll-x" style="max-height:300px;"><table id="tbl-cli"></table></div></div>
  <div class="card"><h2 style="margin-top:0;">Top 20 productos (12m)</h2><div class="scroll-x" style="max-height:300px;"><table id="tbl-prod"></table></div></div>
</div>

<div class="footer">Fuente: base Railway | facturas emitidas (excl. NC/cotiz./canceladas) | valores en USD post-descuento</div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script id="dj" type="application/json">__DATA_JSON__</script>
<script>
const D=JSON.parse(document.getElementById('dj').textContent);
const LS='dialfa_sim_v4';
const LSP='dialfa_sim_v4_profiles';
const FM={mensual:1,trimestral:3,semestral:6,anual:12};
const fU=v=>(v<0?'-$':'$')+Math.abs(Math.round(v)).toLocaleString('en-US');
const fSU=v=>(v>=0?'+':'-')+'$'+Math.abs(Math.round(v)).toLocaleString('en-US');
const fP=v=>(v*100).toFixed(1)+'%';
const fM=s=>{if(!s)return'';const[y,m]=s.split('-');const ms=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];return ms[parseInt(m,10)-1]+" '"+y.slice(2);};
document.getElementById('gen').textContent=D.generated_at.replace('T',' ').slice(0,16);

// --- Profiles state ---
let PS=null;
function defP(){return JSON.parse(JSON.stringify({actual:D.default_profiles.actual,propuesta:D.default_profiles.propuesta}));}
function loadP(){try{const s=JSON.parse(localStorage.getItem(LSP)||'null');if(s&&s.actual&&s.propuesta&&Array.isArray(s.actual.rows)&&Array.isArray(s.propuesta.rows))return s;}catch(e){}return defP();}
function saveP(p){try{localStorage.setItem(LSP,JSON.stringify(p));}catch(e){}}

function renderProfiles(){
  if(!PS)PS=loadP();
  ['actual','propuesta'].forEach(k=>{
    const p=PS[k];
    const dot=k==='actual'?'dot-act':'dot-prop';
    let h='<h3><span class="'+dot+'">&#9679;</span> '+p.label+'</h3>';
    h+='<table class="ptbl"><thead><tr><th>Nombre</th><th>N</th><th>USD</th><th class="c">Var</th><th></th></tr></thead><tbody>';
    p.rows.forEach((r,i)=>{
      h+='<tr>';
      h+='<td><input type="text" class="rn" data-k="'+k+'" data-i="'+i+'" value="'+(r.name||'').replace(/"/g,'&quot;')+'"></td>';
      h+='<td><input type="number" class="rc" data-k="'+k+'" data-i="'+i+'" min="0" step="1" value="'+r.count+'" style="width:40px;"></td>';
      h+='<td><input type="number" class="rs" data-k="'+k+'" data-i="'+i+'" min="0" step="50" value="'+r.salary+'"></td>';
      h+='<td class="act-col"><input type="checkbox" class="rp" data-k="'+k+'" data-i="'+i+'"'+(r.participates?' checked':'')+'></td>';
      h+='<td><button class="btn-rm" data-k="'+k+'" data-i="'+i+'">x</button></td>';
      h+='</tr>';
    });
    h+='</tbody></table>';
    h+='<button class="btn-add" data-k="'+k+'">+ Agregar</button>';
    h+='<div class="pmeta">';
    h+='<label>Aguinaldo <input type="number" id="'+k+'-ag" min="0" max="3" step="0.5" value="'+p.aguinaldo_meses+'"> m</label>';
    h+='<label><input type="checkbox" id="'+k+'-pv"'+(p.pays_variable?' checked':'')+'>Paga variable</label>';
    h+='</div>';
    const fijo=p.rows.reduce((a,r)=>a+r.count*r.salary,0);
    h+='<div class="ptotal">$'+fijo.toLocaleString('en-US')+'/mes <small>fijo</small></div>';
    document.getElementById('pb-'+k).innerHTML=h;
  });
  attachPL();
}

function attachPL(){
  document.querySelectorAll('.rn,.rc,.rs').forEach(el=>el.addEventListener('input',render));
  document.querySelectorAll('.rp').forEach(el=>el.addEventListener('change',render));
  ['actual','propuesta'].forEach(k=>{
    document.getElementById(k+'-ag').addEventListener('input',render);
    document.getElementById(k+'-pv').addEventListener('change',render);
  });
  document.querySelectorAll('.btn-add').forEach(b=>b.addEventListener('click',()=>{
    syncDOM();PS[b.dataset.k].rows.push({name:"Nuevo",count:1,salary:1000,participates:true});saveP(PS);renderProfiles();render();
  }));
  document.querySelectorAll('.btn-rm').forEach(b=>b.addEventListener('click',()=>{
    syncDOM();PS[b.dataset.k].rows.splice(parseInt(b.dataset.i,10),1);saveP(PS);renderProfiles();render();
  }));
}

function syncDOM(){
  ['actual','propuesta'].forEach(k=>{
    const rows=[];
    document.querySelectorAll('.rn[data-k="'+k+'"]').forEach((el,i)=>{
      rows.push({
        name:el.value||'',
        count:Math.max(0,parseFloat(document.querySelector('.rc[data-k="'+k+'"][data-i="'+i+'"]').value)||0),
        salary:Math.max(0,parseFloat(document.querySelector('.rs[data-k="'+k+'"][data-i="'+i+'"]').value)||0),
        participates:document.querySelector('.rp[data-k="'+k+'"][data-i="'+i+'"]').checked,
      });
    });
    PS[k].rows=rows;
    PS[k].aguinaldo_meses=Math.max(0,parseFloat(document.getElementById(k+'-ag').value)||0);
    PS[k].pays_variable=document.getElementById(k+'-pv').checked;
  });
}

function readProf(which){
  const p=PS[which];
  const fijo=p.rows.reduce((a,r)=>a+r.count*r.salary,0);
  const part=p.rows.reduce((a,r)=>a+(r.participates?r.count:0),0);
  return{key:which,label:p.label,rows:p.rows,aguinaldo_meses:p.aguinaldo_meses,pays_variable:p.pays_variable,fijo,participants:part,annual:fijo*(12+p.aguinaldo_meses)};
}

// --- Anchors ---
function renderAnchors(){
  const CA=D.cost_anchors||{};
  const as=[
    {l:'FOB '+CA.cmv_fob_pct+'%',v:CA.cmv_fob_pct},
    {l:'CIF '+CA.cmv_cif_pct+'%',v:CA.cmv_cif_pct},
    {l:'Landed '+CA.cmv_landed_pct+'%',v:CA.cmv_landed_pct},
    {l:'Conservador 40%',v:40},
  ];
  document.getElementById('anchors').innerHTML=as.map(a=>'<span class="anc" data-v="'+a.v+'">'+a.l+'</span>').join('');
  document.querySelectorAll('.anc').forEach(el=>el.addEventListener('click',()=>{document.getElementById('sl-cmv').value=el.dataset.v;render();}));
}

// --- Core calc ---
function calc(){
  const cmv=parseFloat(document.getElementById('sl-cmv').value)/100;
  const pct=parseFloat(document.getElementById('sl-pct').value)/100;
  const winN=parseInt(document.getElementById('sl-win').value,10);
  const capTot=parseFloat(document.getElementById('sl-cap').value)/100;
  const capPerson=parseFloat(document.getElementById('sl-cap-p').value)/100;
  const costoFijo=Math.max(0,parseFloat(document.getElementById('i-fijo').value)||0);
  const costoVarPct=Math.max(0,parseFloat(document.getElementById('i-var').value)||0)/100;
  const ownerDraw=Math.max(0,parseFloat(document.getElementById('i-draw').value)||0);
  const payrollTax=Math.max(0,parseFloat(document.getElementById('i-tax').value)||0)/100;
  const freq=document.getElementById('sel-freq').value;
  const src=document.getElementById('sel-src').value;
  const freqN=FM[freq]||3;

  document.getElementById('o-cmv').textContent=(cmv*100).toFixed(1)+'%';
  document.getElementById('o-pct').textContent=(pct*100).toFixed(2)+'%';
  document.getElementById('o-win').textContent=winN;
  document.getElementById('o-cap').textContent=(capTot*100).toFixed(0)+'%';
  document.getElementById('o-cap-p').textContent=(capPerson*100).toFixed(0)+'%';

  syncDOM();saveP(PS);
  const act=readProf('actual');
  const prop=readProf('propuesta');
  // Revenue: historical months stay real, projected months get appended
  const revProj=Math.max(0,parseFloat(document.getElementById('i-rev-proj').value)||0);
  document.getElementById('o-rev-proj').textContent=revProj>0?'$'+Math.round(revProj).toLocaleString()+'/mes':'0 = solo real';

  // Build months array: real data + projected future months
  const realMonths=D.monthly.map(m=>({...m,projected:false}));
  const allMonths=[...realMonths];
  if(revProj>0){
    // Generate 12 future months after the last real month
    const lastMes=realMonths.length>0?realMonths[realMonths.length-1].mes:'2026-03';
    const [ly,lm]=lastMes.split('-').map(Number);
    for(let i=1;i<=12;i++){
      const nm=lm+i;const ny=ly+Math.floor((nm-1)/12);const mm=((nm-1)%12)+1;
      const mes=ny+'-'+(mm<10?'0':'')+mm;
      allMonths.push({mes,net_usd:revProj,cobranza_usd:revProj,facturas:0,ordenes:0,total_usd:revProj*1.21,
                      cobranza_ars:0,cobranza_rate:0,cobranza_n:0,projected:true});
    }
  }

  const rev=m=>(src==='cobranza'?(m.cobranza_usd||0):(m.net_usd||0));
  // Target uses only REAL months (not projected) to avoid self-referencing
  const realForTarget=realMonths.slice(-winN);
  const opMargin=m=>{const r=rev(m);return r*(1-cmv-costoVarPct)-costoFijo-ownerDraw;};
  const avgOp=realForTarget.reduce((a,m)=>a+opMargin(m),0)/Math.max(realForTarget.length,1);
  const target=avgOp;

  const base=allMonths.map(m=>{
    const r=rev(m);const cmvU=r*cmv;const mb=r-cmvU;const cv=r*costoVarPct;const mo=mb-costoFijo-cv-ownerDraw;
    return{mes:m.mes,rev:r,revFact:m.net_usd||0,revCob:m.cobranza_usd||0,cmvU,mb,cv,mo,projected:!!m.projected};
  });

  // Period grouping
  const periods=[];
  for(let end=base.length;end>0;end-=freqN){
    const start=Math.max(0,end-freqN);
    const sl=base.slice(start,end);
    const sumMo=sl.reduce((a,r)=>a+r.mo,0);
    const pTarget=target*sl.length;
    const exc=Math.max(0,sumMo-pTarget);
    function dist(profile){
      if(!profile.pays_variable||profile.participants===0)return{pool:0,pp:0,capPP:0,hit:false};
      const ppRaw=exc*pct;
      const avgSal=profile.rows.filter(r=>r.participates).reduce((a,r)=>a+r.count*r.salary,0)/profile.participants;
      const capPP=capPerson*avgSal*sl.length;
      const pp=Math.min(ppRaw,capPP);
      return{pool:pp*profile.participants,pp,capPP,hit:ppRaw>capPP};
    }
    periods.unshift({si:start,ei:end-1,months:sl.length,exc,act:dist(act),prop:dist(prop)});
  }

  const m2p=new Map();
  periods.forEach((p,pi)=>{for(let i=p.si;i<=p.ei;i++)m2p.set(i,{p,last:i===p.ei,pi});});

  const rows=base.map((b,i)=>{
    const info=m2p.get(i);const pd=info.p;const isEnd=info.last;
    const poolA=isEnd?pd.act.pool:0;const poolP=isEnd?pd.prop.pool:0;
    const nomA=(act.fijo+poolA)*(1+payrollTax);
    const nomP=(prop.fijo+poolP)*(1+payrollTax);
    return{...b,exc:isEnd?pd.exc:0,poolA,poolP,nomA,nomP,
      pctA:b.rev>0?nomA/b.rev:0,pctP:b.rev>0?nomP/b.rev:0,
      delta:nomP-nomA,isEnd,pi:info.pi,capHit:isEnd&&pd.prop.hit,projected:b.projected};
  });

  return{cmv,pct,winN,capTot,capPerson,costoFijo,costoVarPct,ownerDraw,payrollTax,freq,freqN,src,target,rows,act,prop,periods};
}

// --- Render KPIs ---
function renderKpis(R){
  const s=D.summary;
  const l12=R.rows.slice(-12);
  const totRev=l12.reduce((a,r)=>a+r.rev,0);
  const totMb=l12.reduce((a,r)=>a+r.mb,0);
  const totMo=l12.reduce((a,r)=>a+r.mo,0);
  // Break-even
  const contribR=totRev>0?(totRev-l12.reduce((a,r)=>a+r.cmvU+r.cv,0))/totRev:0;
  const overhead=(R.costoFijo+R.ownerDraw)*12+R.prop.fijo*(12+R.prop.aguinaldo_meses)*(1+R.payrollTax);
  const be=contribR>0?overhead/contribR:0;
  // Utilidad propuesta
  const nomPropAn=l12.reduce((a,r)=>a+r.nomP,0)+R.prop.fijo*R.prop.aguinaldo_meses*(1+R.payrollTax);
  const util=totMo-nomPropAn;
  const avgCob=s.avg_cob_12m||s.avg_net_12m;
  const ks=[
    {l:'Cobranza prom. 12m',v:fU(avgCob),s:'mensual USD'},
    {l:'Mejor mes',v:fU(s.max_month.usd),s:fM(s.max_month.mes)},
    {l:'Margen bruto',v:fP(totRev>0?totMb/totRev:0),s:fU(totMb)+' anual'},
    {l:'Break-even',v:fU(be/12)+'/m',s:fU(be)+' anual'},
    {l:'Utilidad propuesta',v:fU(util),s:util>=0?'ganancia':'perdida'},
  ];
  document.getElementById('kpis').innerHTML=ks.map(k=>'<div class="kpi"><div class="kpi-l">'+k.l+'</div><div class="kpi-v">'+k.v+'</div><div class="kpi-s">'+k.s+'</div></div>').join('');
}

// --- Render Recommendation ---
function renderRec(R){
  const{prop,periods,pct,capPerson,freqN}=R;
  if(!prop.pays_variable||prop.participants===0){document.getElementById('rec').innerHTML='<b>Sin participantes</b> en la propuesta. Activa "Paga variable" y marca participantes.';return;}
  // Find max % that fits the cap for all periods
  let maxPct=30;
  const avgSal=prop.rows.filter(r=>r.participates).reduce((a,r)=>a+r.count*r.salary,0)/prop.participants;
  periods.forEach(p=>{
    if(p.exc>0){
      const capPP=capPerson*avgSal*p.months;
      const fitPct=capPP/p.exc;
      if(fitPct<maxPct)maxPct=fitPct;
    }
  });
  maxPct=Math.min(maxPct,30);
  const ppMonth=periods.length>0?periods.reduce((a,p)=>a+p.prop.pp,0)/periods.length:0;
  document.getElementById('rec').innerHTML='<b>Recomendacion:</b> Max % variable que cabe en el cap = <b>'+(maxPct*100).toFixed(1)+'%</b>. Con el '+((pct*100).toFixed(1))+'% actual, cada participante recibe en promedio <b>'+fU(ppMonth)+'</b>/periodo ('+(R.freq)+').<br>'+prop.participants+' participantes, sueldo promedio participante: '+fU(avgSal)+'/mes, cap individual: '+fU(capPerson*avgSal*freqN)+'/periodo.';
}

// --- P&L Annual ---
function renderPL(R){
  const l12=R.rows.slice(-12);
  const totRevA=l12.reduce((a,r)=>a+r.rev,0);
  const totRevP=totRevA; // same revenue
  const totCmvA=l12.reduce((a,r)=>a+r.cmvU,0);
  const totMbA=totRevA-totCmvA;
  const totCf=R.costoFijo*12;
  const totCv=l12.reduce((a,r)=>a+r.cv,0);
  const totDraw=R.ownerDraw*12;
  const totMoA=totMbA-totCf-totCv-totDraw;
  const nomFixA=R.act.fijo*12;const nomFixP=R.prop.fijo*12;
  const agA=R.act.fijo*R.act.aguinaldo_meses;const agP=R.prop.fijo*R.prop.aguinaldo_meses;
  const varA=l12.reduce((a,r)=>a+r.poolA,0);const varP=l12.reduce((a,r)=>a+r.poolP,0);
  const csA=(nomFixA+agA+varA)*R.payrollTax;const csP=(nomFixP+agP+varP)*R.payrollTax;
  const totNomA=nomFixA+agA+varA+csA;const totNomP=nomFixP+agP+varP+csP;
  const utilA=totMoA-totNomA;const utilP=totMoA-totNomP;
  const pctNA=totRevA>0?totNomA/totRevA:0;const pctNP=totRevA>0?totNomP/totRevA:0;

  function row(label,a,p,fmt){
    const d=p-a;const f=fmt||fU;
    return'<tr><td>'+label+'</td><td class="r">'+f(a)+'</td><td class="r">'+f(p)+'</td><td class="r '+(d>=0?'pos':'neg')+'">'+fSU(d)+'</td></tr>';
  }
  function rowPct(label,a,p){
    const d=p-a;
    return'<tr><td>'+label+'</td><td class="r">'+fP(a)+'</td><td class="r">'+fP(p)+'</td><td class="r '+(d>=0?'neg':'pos')+'">'+((d>=0?'+':'')+fP(d))+'</td></tr>';
  }
  const hasProj=l12.some(r=>r.projected);
  const projNote=hasProj?'<tr><td colspan="4" style="text-align:center;color:#10b981;font-size:11px;padding:6px;background:rgba(16,185,129,.06);border-radius:4px;">Incluye meses proyectados a $'+Math.round(parseFloat(document.getElementById('i-rev-proj').value)||0).toLocaleString()+'/mes</td></tr>':'';
  let h='<thead><tr><th></th><th class="r">Actual</th><th class="r">Propuesta</th><th class="r">Delta</th></tr></thead><tbody>';
  h+=projNote;
  h+=row('Revenue',totRevA,totRevP);
  h+=row('CMV',totCmvA,totCmvA);
  h+='<tr style="font-weight:600;border-top:2px solid var(--border);"><td>Margen bruto</td><td class="r">'+fU(totMbA)+'</td><td class="r">'+fU(totMbA)+'</td><td class="r">-</td></tr>';
  h+=row('Costos fijos',totCf,totCf);
  h+=row('Costos var.',totCv,totCv);
  h+=row('Retiros socio',totDraw,totDraw);
  h+='<tr style="font-weight:600;border-top:2px solid var(--border);"><td>Margen operativo</td><td class="r">'+fU(totMoA)+'</td><td class="r">'+fU(totMoA)+'</td><td class="r">-</td></tr>';
  h+=row('Nomina fija',nomFixA,nomFixP);
  h+=row('Aguinaldo',agA,agP);
  h+=row('Variable',varA,varP);
  h+=row('Cargas sociales',csA,csP);
  h+='<tr style="font-weight:600;border-top:2px solid var(--border);">'+row('Total nomina',totNomA,totNomP).slice(4);
  h+='<tr style="font-weight:700;border-top:2px solid var(--accent);"><td>Utilidad final</td><td class="r '+(utilA>=0?'pos':'neg')+'">'+fU(utilA)+'</td><td class="r '+(utilP>=0?'pos':'neg')+'">'+fU(utilP)+'</td><td class="r '+(utilP-utilA>=0?'pos':'neg')+'">'+fSU(utilP-utilA)+'</td></tr>';
  h+=rowPct('% nomina/fact.',pctNA,pctNP);
  h+='</tbody>';
  document.getElementById('tbl-pl').innerHTML=h;
}

// --- Monthly table ---
function renderMonthly(R){
  const{rows,act,prop}=R;
  let h='<thead><tr><th>Mes</th><th class="r">Facturado</th><th class="r">Cobrado</th><th class="r">Margen Op</th><th class="r">Excedente</th><th class="r">Variable</th><th class="r">Nom. Prop.</th><th class="r">% prop</th><th class="r">Delta</th></tr></thead><tbody>';
  rows.forEach(r=>{
    const bg=r.projected?'background:rgba(16,185,129,.06);border-left:3px solid rgba(16,185,129,.4);'
             :r.capHit?'background:rgba(239,68,68,.08);':'';
    h+='<tr style="'+bg+'">';
    const mesLabel=r.projected?fM(r.mes)+' <span style="font-size:9px;color:#10b981;font-weight:600;">PROY</span>':fM(r.mes);
    h+='<td>'+mesLabel+'</td>';
    h+='<td class="r">'+(r.projected?'<span style="color:var(--muted);">-</span>':fU(r.revFact))+'</td>';
    h+='<td class="r">'+(r.projected?fU(r.rev):fU(r.revCob))+'</td>';
    h+='<td class="r '+(r.mo>=0?'pos':'neg')+'">'+fU(r.mo)+'</td>';
    h+='<td class="r">'+(r.isEnd?fU(r.exc):'-')+'</td>';
    h+='<td class="r">'+(r.isEnd?fU(r.poolP):'-')+'</td>';
    h+='<td class="r">'+fU(r.nomP)+'</td>';
    h+='<td class="r">'+(r.pctP*100).toFixed(1)+'%</td>';
    h+='<td class="r '+(r.delta>=0?'neg':'pos')+'">'+fSU(r.delta)+'</td>';
    h+='</tr>';
  });
  h+='</tbody>';
  document.getElementById('tbl-m').innerHTML=h;
}

// --- Charts ---
let charts={};
function renderCharts(R){
  const{rows,act,prop,capTot}=R;
  const labels=rows.map(r=>fM(r.mes));
  const bOpts={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#94a3b8',font:{size:10}}}},scales:{x:{ticks:{color:'#64748b',font:{size:9}},grid:{color:'rgba(51,65,85,.3)'}},y:{ticks:{color:'#64748b',font:{size:9},callback:v=>'$'+Math.round(v/1000)+'k'},grid:{color:'rgba(51,65,85,.3)'}}}};

  if(charts.c1)charts.c1.destroy();
  if(charts.c2)charts.c2.destroy();

  charts.c1=new Chart(document.getElementById('c1'),{
    type:'bar',
    data:{labels,datasets:[
      {label:'Fijo propuesto',data:rows.map(()=>prop.fijo*(1+R.payrollTax)),backgroundColor:'#3b82f6'},
      {label:'Variable',data:rows.map(r=>r.poolP*(1+R.payrollTax)),backgroundColor:'#10b981'},
      {label:'Fijo actual',data:rows.map(()=>act.fijo*(1+R.payrollTax)),type:'line',borderColor:'#94a3b8',borderDash:[5,5],backgroundColor:'transparent',pointRadius:0,borderWidth:2},
    ]},
    options:{...bOpts,scales:{x:{...bOpts.scales.x,stacked:true},y:{...bOpts.scales.y,stacked:true}}}
  });

  charts.c2=new Chart(document.getElementById('c2'),{
    type:'line',
    data:{labels,datasets:[
      {label:'% actual',data:rows.map(r=>+(r.pctA*100).toFixed(2)),borderColor:'#94a3b8',backgroundColor:'transparent',tension:.3,pointRadius:2,borderWidth:2},
      {label:'% propuesta',data:rows.map(r=>+(r.pctP*100).toFixed(2)),borderColor:'#a855f7',backgroundColor:'rgba(168,85,247,.15)',fill:true,tension:.3,pointRadius:3,borderWidth:2},
      {label:'Tope',data:rows.map(()=>+(capTot*100)),borderColor:'#ef4444',borderDash:[6,4],pointRadius:0,borderWidth:1.5},
    ]},
    options:{...bOpts,scales:{...bOpts.scales,y:{...bOpts.scales.y,ticks:{...bOpts.scales.y.ticks,callback:v=>v+'%'},min:0}}}
  });
}

// --- Top tables ---
function renderCli(){
  const tc=D.top_clients||[];
  let tot=tc.reduce((a,c)=>a+(c.net_usd||0),0);
  let h='<thead><tr><th>#</th><th>Cliente</th><th class="r">Facturas</th><th class="r">USD</th><th class="r">%</th></tr></thead><tbody>';
  tc.forEach((c,i)=>{
    const p=tot>0?(c.net_usd/tot*100).toFixed(1):'0';
    h+='<tr><td>'+(i+1)+'</td><td>'+c.cliente+'</td><td class="r">'+c.facturas+'</td><td class="r">'+fU(c.net_usd)+'</td><td class="r">'+p+'%</td></tr>';
  });
  h+='</tbody>';
  document.getElementById('tbl-cli').innerHTML=h;
}
function renderProd(){
  const tp=D.top_products||[];
  let h='<thead><tr><th>#</th><th>Codigo</th><th>Descripcion</th><th class="r">Uds</th><th class="r">USD</th></tr></thead><tbody>';
  tp.forEach((p,i)=>{
    h+='<tr><td>'+(i+1)+'</td><td>'+p.code+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(p.descripcion||'')+'</td><td class="r">'+Math.round(p.unidades)+'</td><td class="r">'+fU(p.facturado_usd)+'</td></tr>';
  });
  h+='</tbody>';
  document.getElementById('tbl-prod').innerHTML=h;
}

// --- Orchestrator ---
function render(){
  const R=calc();
  renderKpis(R);renderRec(R);renderPL(R);renderMonthly(R);renderCharts(R);
  // Persist
  try{localStorage.setItem(LS,JSON.stringify({
    cmv:document.getElementById('sl-cmv').value,
    pct:document.getElementById('sl-pct').value,
    win:document.getElementById('sl-win').value,
    cap:document.getElementById('sl-cap').value,
    capP:document.getElementById('sl-cap-p').value,
    fijo:document.getElementById('i-fijo').value,
    varP:document.getElementById('i-var').value,
    draw:document.getElementById('i-draw').value,
    tax:document.getElementById('i-tax').value,
    revProj:document.getElementById('i-rev-proj').value,
    freq:document.getElementById('sel-freq').value,
    src:document.getElementById('sel-src').value,
  }));}catch(e){}
}

// --- Restore state ---
try{
  const s=JSON.parse(localStorage.getItem(LS)||'{}');
  if(s.cmv!==undefined)document.getElementById('sl-cmv').value=s.cmv;
  if(s.pct!==undefined)document.getElementById('sl-pct').value=s.pct;
  if(s.win!==undefined)document.getElementById('sl-win').value=s.win;
  if(s.cap!==undefined)document.getElementById('sl-cap').value=s.cap;
  if(s.capP!==undefined)document.getElementById('sl-cap-p').value=s.capP;
  if(s.fijo!==undefined)document.getElementById('i-fijo').value=s.fijo;
  if(s.varP!==undefined)document.getElementById('i-var').value=s.varP;
  if(s.draw!==undefined)document.getElementById('i-draw').value=s.draw;
  if(s.tax!==undefined)document.getElementById('i-tax').value=s.tax;
  if(s.revProj!==undefined)document.getElementById('i-rev-proj').value=s.revProj;
  if(s.freq!==undefined)document.getElementById('sel-freq').value=s.freq;
  if(s.src!==undefined)document.getElementById('sel-src').value=s.src;
}catch(e){}

// --- Event listeners ---
['sl-cmv','sl-pct','sl-win','sl-cap','sl-cap-p','i-fijo','i-var','i-draw','i-tax','i-rev-proj'].forEach(id=>{
  document.getElementById(id).addEventListener('input',render);
});
['sel-freq','sel-src'].forEach(id=>{
  document.getElementById(id).addEventListener('change',render);
});
document.getElementById('btn-reset-all').addEventListener('click',()=>{
  localStorage.removeItem(LS);localStorage.removeItem(LSP);
  PS=defP();
  const d=D.default_company_costs||{};
  document.getElementById('sl-cmv').value=D.cost_anchors.cmv_landed_pct||32.4;
  document.getElementById('sl-pct').value=5;
  document.getElementById('sl-win').value=12;
  document.getElementById('sl-cap').value=30;
  document.getElementById('sl-cap-p').value=50;
  document.getElementById('i-fijo').value=d.fixed_usd_month||12800;
  document.getElementById('i-var').value=d.variable_pct_sales||8;
  document.getElementById('i-draw').value=d.owner_draw_usd||15800;
  document.getElementById('i-tax').value=d.payroll_tax_pct||40;
  document.getElementById('i-rev-proj').value=0;
  document.getElementById('sel-freq').value='trimestral';
  document.getElementById('sel-src').value='cobranza';
  renderProfiles();render();
});

// --- Init ---
renderProfiles();
renderAnchors();
renderCli();
renderProd();
render();
</script>
</body>
</html>
"""


def main():
    print("[1/3] Connecting to %s" % DATABASE_URL.split('@')[-1])
    raw = fetch_all()
    print("      monthly=%d  clients=%d  products=%d" % (
        len(raw['monthly']), len(raw['top_clients']), len(raw['top_products'])))

    print("[2/3] Post-processing...")
    data = build_derived(raw)
    s = data["summary"]
    print("      avg 12m = $%s USD | best month %s = $%s" % (
        f"{s['avg_net_12m']:,}", s['max_month']['mes'], f"{s['max_month']['usd']:,}"))
    ca = data["cost_anchors"]
    print("      CMV anchors: FOB %.1f%% / CIF %.1f%% / Landed %.1f%%" % (
        ca['cmv_fob_pct'], ca['cmv_cif_pct'], ca['cmv_landed_pct']))
    print("      coverage: %.1f%% (%d/%d articles, %d proformas) -> quality: %s" % (
        ca['cobertura_pct'], ca['articulos_con_costo'], ca['articulos_facturados'],
        ca['proformas_cargadas'], ca['calidad']))

    print("[3/3] Generating HTML v4...")
    json_inline = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = HTML_TEMPLATE.replace("__DATA_JSON__", json_inline)
    HTML_OUT.write_text(html, encoding="utf-8")
    print("      output -> %s" % HTML_OUT)
    print("")
    print("[OK] Done. Open in browser:")
    print("  file:///%s" % str(HTML_OUT).replace('\\', '/'))


if __name__ == "__main__":
    main()
