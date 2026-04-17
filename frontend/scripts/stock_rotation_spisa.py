"""
Stock rotation analysis using SPISA's EXACT methodology:
  - WMA: linear weights (oldest=1, newest=N)
  - Classification: daysSinceLastSale + avgMonthlySales(simple) + trend direction
  - Active stock trends: best consecutive N-month window in entire history
  - Trend direction: first half vs second half avg, >20% = increasing/decreasing
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from pathlib import Path
from decimal import Decimal
import psycopg2, psycopg2.extras

env = (Path(__file__).parent.parent / ".env").read_text(encoding="utf-8")
url = next(line.split("=",1)[1].strip().strip('"').strip("'")
           for line in env.splitlines()
           if line.strip().startswith("DATABASE_URL") and not line.strip().startswith("#"))
conn = psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)
cur = conn.cursor()

# ============================================================================
# 1. Get per-article monthly sales (last 12 months) + last sale date
# ============================================================================
cur.execute("""
WITH monthly AS (
  SELECT
    soi.article_id,
    TO_CHAR(i.invoice_date, 'YYYY-MM') AS mes,
    SUM(soi.quantity) AS qty
  FROM sales_order_items soi
  JOIN sales_orders so ON soi.sales_order_id = so.id
  JOIN invoices i ON i.sales_order_id = so.id
  WHERE i.is_printed = true AND i.is_cancelled = false
    AND i.deleted_at IS NULL AND so.deleted_at IS NULL
    AND i.invoice_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '12 months')
    AND i.invoice_date < date_trunc('month', CURRENT_DATE)
  GROUP BY soi.article_id, TO_CHAR(i.invoice_date, 'YYYY-MM')
),
last_sale AS (
  SELECT soi.article_id, MAX(i.invoice_date) AS last_sale_date
  FROM sales_order_items soi
  JOIN sales_orders so ON soi.sales_order_id = so.id
  JOIN invoices i ON i.sales_order_id = so.id
  WHERE i.is_printed = true AND i.is_cancelled = false
    AND i.deleted_at IS NULL AND so.deleted_at IS NULL
  GROUP BY soi.article_id
),
-- Generate the 12-month calendar
cal AS (
  SELECT TO_CHAR(d, 'YYYY-MM') AS mes,
  ROW_NUMBER() OVER (ORDER BY d) AS month_idx  -- 1=oldest, 12=newest
  FROM generate_series(
    date_trunc('month', CURRENT_DATE) - INTERVAL '12 months',
    date_trunc('month', CURRENT_DATE) - INTERVAL '1 month',
    '1 month'
  ) AS d
),
-- For each article, create full 12-month series (0 for missing months)
article_series AS (
  SELECT
    a.id AS article_id,
    a.code, a.description, a.stock, a.unit_price,
    COALESCE(NULLIF(a.last_purchase_price, 0), lp.fob, 0) AS cost_usd,
    cal.mes,
    cal.month_idx,
    COALESCE(m.qty, 0) AS qty,
    ls.last_sale_date,
    EXTRACT(DAY FROM (NOW() - ls.last_sale_date)) AS days_since_last_sale
  FROM articles a
  CROSS JOIN cal
  LEFT JOIN monthly m ON m.article_id = a.id AND m.mes = cal.mes
  LEFT JOIN last_sale ls ON ls.article_id = a.id
  LEFT JOIN (
    SELECT DISTINCT ON (soi2.article_id) soi2.article_id, soi2.proforma_unit_price AS fob
    FROM supplier_order_items soi2
    JOIN supplier_orders so2 ON so2.id = soi2.supplier_order_id
    WHERE soi2.proforma_unit_price > 0 AND so2.deleted_at IS NULL
    ORDER BY soi2.article_id, so2.order_date DESC
  ) lp ON lp.article_id = a.id
  WHERE a.deleted_at IS NULL AND a.is_active = true AND a.stock > 0
),
-- Compute WMA and classification per article
article_stats AS (
  SELECT
    article_id, code, description, stock, unit_price, cost_usd,
    last_sale_date, days_since_last_sale,
    -- Simple average (for classification, per SPISA)
    SUM(qty) / 12.0 AS avg_simple,
    -- WMA: weight = month_idx (1=oldest, 12=newest), denominator = 1+2+...+12 = 78
    SUM(qty * month_idx) / 78.0 AS avg_wma,
    -- Total sold
    SUM(qty) AS total_12m,
    -- Trend direction: first 6 months avg vs last 6 months avg
    AVG(qty) FILTER (WHERE month_idx <= 6) AS avg_first_half,
    AVG(qty) FILTER (WHERE month_idx > 6) AS avg_second_half,
    -- Months with sales
    COUNT(*) FILTER (WHERE qty > 0) AS months_with_sales
  FROM article_series
  GROUP BY article_id, code, description, stock, unit_price, cost_usd,
           last_sale_date, days_since_last_sale
),
classified AS (
  SELECT *,
    -- Trend direction (SPISA: >20% change = increasing/decreasing)
    CASE
      WHEN avg_first_half = 0 AND avg_second_half = 0 THEN 'none'
      WHEN avg_first_half = 0 THEN 'increasing'
      WHEN ((avg_second_half - avg_first_half) / avg_first_half * 100) > 20 THEN 'increasing'
      WHEN ((avg_second_half - avg_first_half) / avg_first_half * 100) < -20 THEN 'decreasing'
      ELSE 'stable'
    END AS trend,
    -- SPISA classification (exact logic)
    CASE
      WHEN last_sale_date IS NULL THEN 'NEVER_SOLD'
      WHEN days_since_last_sale > 365 THEN 'DEAD_STOCK'
      WHEN days_since_last_sale <= 90 AND avg_simple >= 5 THEN 'ACTIVE'
      WHEN days_since_last_sale > 180 THEN 'SLOW_MOVING'
      WHEN avg_simple < 5 AND ((avg_second_half - avg_first_half) / NULLIF(avg_first_half, 0) * 100) < -20 THEN 'SLOW_MOVING'
      WHEN avg_simple > 0 THEN 'SLOW_MOVING'
      ELSE 'DEAD_STOCK'
    END AS status,
    -- Rotation months using WMA (more accurate for growing/shrinking trends)
    CASE WHEN avg_wma > 0 THEN stock / avg_wma ELSE NULL END AS rot_wma_months,
    -- Rotation months using simple avg
    CASE WHEN avg_simple > 0 THEN stock / avg_simple ELSE NULL END AS rot_simple_months
  FROM article_stats
)
SELECT * FROM classified ORDER BY status, rot_wma_months ASC NULLS LAST
""")
articles = cur.fetchall()

# Cast decimals
def c(v):
    if isinstance(v, Decimal): return float(v)
    return v

for a in articles:
    for k in a: a[k] = c(a[k])

# ============================================================================
# 2. Aggregate by status
# ============================================================================
from collections import defaultdict
by_status = defaultdict(list)
for a in articles:
    by_status[a['status']].append(a)

print("=" * 100)
print("ANALISIS DE ROTACION — METODOLOGIA SPISA EXACTA (WMA lineal, clasificacion por dias+avg+trend)")
print("=" * 100)
print()

for status in ['ACTIVE', 'SLOW_MOVING', 'DEAD_STOCK', 'NEVER_SOLD']:
    arts = by_status.get(status, [])
    if not arts:
        print(f"{status}: 0 articulos")
        print()
        continue

    total_stock = sum(a['stock'] for a in arts)
    total_vendido = sum(a['total_12m'] for a in arts)
    total_retail = sum(a['stock'] * a['unit_price'] for a in arts)
    total_costo = sum(a['stock'] * a['cost_usd'] for a in arts if a['cost_usd'] > 0)

    # WMA-based monthly outflow
    wma_outflow_retail = sum(a['avg_wma'] * a['unit_price'] for a in arts)
    wma_outflow_units = sum(a['avg_wma'] for a in arts)

    # Value-weighted rotation (using WMA)
    numerator = sum(a['rot_wma_months'] * a['stock'] * a['unit_price'] for a in arts if a['rot_wma_months'] is not None)
    denominator = sum(a['stock'] * a['unit_price'] for a in arts if a['rot_wma_months'] is not None)
    rot_weighted = numerator / denominator if denominator > 0 else None

    # Median rotation (unweighted, per article)
    rots = sorted([a['rot_wma_months'] for a in arts if a['rot_wma_months'] is not None])
    rot_median = rots[len(rots)//2] if rots else None

    # Articles by rotation bucket
    r_under_6 = [a for a in arts if a['rot_wma_months'] is not None and a['rot_wma_months'] < 6]
    r_6_12 = [a for a in arts if a['rot_wma_months'] is not None and 6 <= a['rot_wma_months'] < 12]
    r_12_24 = [a for a in arts if a['rot_wma_months'] is not None and 12 <= a['rot_wma_months'] < 24]
    r_24_60 = [a for a in arts if a['rot_wma_months'] is not None and 24 <= a['rot_wma_months'] < 60]
    r_60plus = [a for a in arts if a['rot_wma_months'] is not None and a['rot_wma_months'] >= 60]
    r_none = [a for a in arts if a['rot_wma_months'] is None]

    emoji = {'ACTIVE': '(V)', 'SLOW_MOVING': '(!)', 'DEAD_STOCK': '(X)', 'NEVER_SOLD': '(-)'}[status]
    print(f"{emoji} {status}: {len(arts)} articulos")
    print(f"    Stock: {total_stock:>10,} uds | Vendido 12m: {total_vendido:>10,} uds")
    print(f"    Valor retail: ${total_retail:>12,.0f} | Costo conocido: ${total_costo:>10,.0f}")
    print(f"    Salida WMA:   ${wma_outflow_retail:>12,.0f}/mes retail | {wma_outflow_units:>10,.0f} uds/mes")
    if rot_weighted is not None:
        print(f"    Rotacion ponderada (WMA): {rot_weighted:>8.1f} meses")
    if rot_median is not None:
        print(f"    Rotacion mediana (WMA):   {rot_median:>8.1f} meses")
    print(f"    Distribucion de rotacion:")
    print(f"      < 6 meses:    {len(r_under_6):>4} arts  ${sum(a['stock']*a['unit_price'] for a in r_under_6):>10,.0f} retail  ** PAPA CALIENTE")
    print(f"      6-12 meses:   {len(r_6_12):>4} arts  ${sum(a['stock']*a['unit_price'] for a in r_6_12):>10,.0f} retail")
    print(f"      12-24 meses:  {len(r_12_24):>4} arts  ${sum(a['stock']*a['unit_price'] for a in r_12_24):>10,.0f} retail")
    print(f"      24-60 meses:  {len(r_24_60):>4} arts  ${sum(a['stock']*a['unit_price'] for a in r_24_60):>10,.0f} retail")
    print(f"      60+ meses:    {len(r_60plus):>4} arts  ${sum(a['stock']*a['unit_price'] for a in r_60plus):>10,.0f} retail  ** SOBRESTOCK")
    print(f"      sin rotacion: {len(r_none):>4} arts  ${sum(a['stock']*a['unit_price'] for a in r_none):>10,.0f} retail")
    print()

# ============================================================================
# 3. Top 20 fastest moving ACTIVE articles (papa caliente real)
# ============================================================================
print("=" * 100)
print("TOP 20 ARTICULOS ACTIVOS MAS RAPIDOS (papa caliente real)")
print("Ordenados por rotacion WMA ascendente (menos meses = mas rapido)")
print("=" * 100)
active_with_rot = [a for a in by_status.get('ACTIVE', []) if a['rot_wma_months'] is not None]
active_sorted = sorted(active_with_rot, key=lambda a: a['rot_wma_months'])[:20]
print(f"  {'Codigo':15s} {'Stock':>7} {'Avg sim':>8} {'WMA':>8} {'Rot WMA':>8} {'Trend':>10} {'Sale/m ret':>10}  Descripcion")
print("  " + "-" * 95)
for a in active_sorted:
    alert = " !!" if a['rot_wma_months'] < 6 else " !" if a['rot_wma_months'] < 12 else ""
    sale_ret = a['avg_wma'] * a['unit_price']
    print(f"  {a['code']:15s} {int(a['stock']):>7,} {a['avg_simple']:>8.1f} {a['avg_wma']:>8.1f} {a['rot_wma_months']:>7.1f}m{alert} {a['trend']:>10s} ${sale_ret:>9,.0f}  {(a['description'] or '')[:25]}")

# ============================================================================
# 4. COLCHON real para papa caliente
# ============================================================================
print()
print("=" * 100)
print("COLCHON REAL PARA MERCADERIA PAPA CALIENTE")
print("(articulos activos con < 12 meses de stock segun WMA)")
print("=" * 100)
papa_caliente = [a for a in active_with_rot if a['rot_wma_months'] < 12]
print(f"\n  Articulos con < 12m de stock (WMA): {len(papa_caliente)}")
if papa_caliente:
    total_wma_outflow = sum(a['avg_wma'] * a['unit_price'] for a in papa_caliente)
    total_wma_outflow_cif = total_wma_outflow * 0.27  # ~27% of retail = CIF
    total_stock_retail = sum(a['stock'] * a['unit_price'] for a in papa_caliente)
    print(f"  Salida mensual (retail):  ${total_wma_outflow:>10,.0f}")
    print(f"  Salida mensual (CIF est): ${total_wma_outflow_cif:>10,.0f}")
    print(f"  Stock actual (retail):    ${total_stock_retail:>10,.0f}")
    print()
    print(f"  Colchon para reponer en los proximos 6 meses:")
    print(f"    A CIF x1.5:  ${total_wma_outflow_cif * 6:>10,.0f}")
    print(f"    A FOB puro:  ${total_wma_outflow * 0.18 * 6:>10,.0f}")
    print()
    for a in papa_caliente:
        sale_cif = a['avg_wma'] * a['unit_price'] * 0.27
        meses_para_0 = a['rot_wma_months']
        print(f"    {a['code']:15s} rota en {meses_para_0:>5.1f}m | sale ${sale_cif:>6,.0f}/mes CIF | {a['trend']:>10s} | stock {int(a['stock']):>5} | {(a['description'] or '')[:30]}")

# Also check: articles with 0 stock that SHOULD have stock (sold recently)
print()
print("=" * 100)
print("STOCKOUTS: articulos con CERO stock que se vendieron en los ultimos 6 meses")
print("(oportunidad perdida — clientes piden y no tenes)")
print("=" * 100)
cur.execute("""
WITH recent_sales AS (
  SELECT soi.article_id, SUM(soi.quantity) AS qty_6m,
         MAX(i.invoice_date) AS last_sale
  FROM sales_order_items soi
  JOIN sales_orders so ON soi.sales_order_id = so.id
  JOIN invoices i ON i.sales_order_id = so.id
  WHERE i.is_printed = true AND i.is_cancelled = false
    AND i.deleted_at IS NULL AND so.deleted_at IS NULL
    AND i.invoice_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '6 months')
  GROUP BY soi.article_id
)
SELECT a.code, a.description, a.stock, rs.qty_6m, rs.last_sale::date,
       a.unit_price, (rs.qty_6m * a.unit_price) AS revenue_lost_6m
FROM articles a
JOIN recent_sales rs ON rs.article_id = a.id
WHERE a.deleted_at IS NULL AND a.is_active = true AND a.stock <= 0
ORDER BY rs.qty_6m DESC LIMIT 15
""")
stockouts = cur.fetchall()
if stockouts:
    print(f"\n  {'Codigo':15s} {'Stock':>6} {'Vend 6m':>8} {'Ult venta':>11} {'Rev perdido':>11}  Descripcion")
    print("  " + "-" * 80)
    for s in stockouts:
        print(f"  {s['code']:15s} {int(c(s['stock'])):>6} {int(c(s['qty_6m'])):>8} {s['last_sale']} ${c(s['revenue_lost_6m']):>10,.0f}  {(s['description'] or '')[:25]}")
else:
    print("  No hay stockouts recientes.")

conn.close()
