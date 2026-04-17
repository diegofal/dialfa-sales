"""Quick stock rotation analysis using WMA methodology."""
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

def ff(v):
    if v is None: return "N/A"
    if isinstance(v, Decimal): v = float(v)
    if isinstance(v, float) and abs(v) >= 1: return f"${v:,.0f}"
    return str(v)

# ===== 1. Per-status rotation with WMA =====
print("=" * 90)
print("ROTACION POR STATUS (WMA: ultimos 3m pesan doble)")
print("=" * 90)

cur.execute("""
WITH monthly_sales AS (
  SELECT soi.article_id,
         date_trunc('month', i.invoice_date) AS mes,
         SUM(soi.quantity) AS qty
  FROM sales_order_items soi
  JOIN sales_orders so ON soi.sales_order_id = so.id
  JOIN invoices i ON i.sales_order_id = so.id
  WHERE i.is_cancelled = false AND i.deleted_at IS NULL AND so.deleted_at IS NULL
    AND i.invoice_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '12 months')
    AND i.invoice_date < date_trunc('month', CURRENT_DATE)
  GROUP BY soi.article_id, date_trunc('month', i.invoice_date)
),
article_wma AS (
  SELECT article_id,
         SUM(qty) AS total_12m,
         SUM(qty) / 12.0 AS avg_simple,
         SUM(CASE WHEN mes >= (date_trunc('month', CURRENT_DATE) - INTERVAL '3 months')
                  THEN qty * 2.0 ELSE qty END) / 15.0 AS avg_wma
  FROM monthly_sales GROUP BY article_id
),
last_sale AS (
  SELECT soi.article_id, MAX(i.invoice_date) AS last_sale_date,
         SUM(soi.quantity) / GREATEST(1, EXTRACT(MONTH FROM AGE(NOW(), MIN(i.invoice_date)))) AS hist_avg
  FROM sales_order_items soi
  JOIN sales_orders so ON soi.sales_order_id = so.id
  JOIN invoices i ON i.sales_order_id = so.id
  WHERE i.is_cancelled = false AND i.deleted_at IS NULL AND so.deleted_at IS NULL
  GROUP BY soi.article_id
),
classified AS (
  SELECT a.id, a.code, a.stock, a.unit_price,
    COALESCE(aw.avg_wma, 0) AS avg_wma,
    COALESCE(aw.total_12m, 0) AS vendido_12m,
    CASE WHEN COALESCE(aw.avg_wma, 0) > 0 THEN a.stock / aw.avg_wma ELSE NULL END AS rot_meses,
    CASE
      WHEN ls.last_sale_date IS NULL THEN 'NEVER_SOLD'
      WHEN EXTRACT(DAY FROM (NOW() - ls.last_sale_date)) > 365 THEN 'DEAD_STOCK'
      WHEN EXTRACT(DAY FROM (NOW() - ls.last_sale_date)) <= 90
           AND COALESCE(aw.avg_simple, 0) >= 5 THEN 'ACTIVE'
      ELSE 'SLOW_MOVING'
    END AS status
  FROM articles a
  LEFT JOIN article_wma aw ON aw.article_id = a.id
  LEFT JOIN last_sale ls ON ls.article_id = a.id
  WHERE a.deleted_at IS NULL AND a.is_active = true AND a.stock > 0
)
SELECT status,
  COUNT(*) AS arts,
  SUM(stock)::bigint AS uds_stock,
  SUM(vendido_12m)::bigint AS uds_vendidas_12m,
  SUM(avg_wma * 12)::bigint AS uds_proyectadas_anual_wma,
  -- Rotacion ponderada por valor
  CASE WHEN SUM(CASE WHEN rot_meses IS NOT NULL THEN stock * unit_price ELSE 0 END) > 0
    THEN SUM(CASE WHEN rot_meses IS NOT NULL THEN rot_meses * stock * unit_price ELSE 0 END)
         / SUM(CASE WHEN rot_meses IS NOT NULL THEN stock * unit_price ELSE 0 END)
    ELSE NULL END AS rot_ponderada_meses,
  SUM(stock * unit_price) AS valor_retail,
  SUM(avg_wma * unit_price) AS salida_mensual_retail
FROM classified
GROUP BY status
ORDER BY CASE status WHEN 'ACTIVE' THEN 1 WHEN 'SLOW_MOVING' THEN 2 WHEN 'DEAD_STOCK' THEN 3 WHEN 'NEVER_SOLD' THEN 4 END
""")
rows = cur.fetchall()

print()
hdr = f"{'Status':15s} | {'Arts':>5} | {'Stock uds':>10} | {'Vend 12m':>10} | {'Proy WMA/a':>10} | {'Rot WMA':>10} | {'Valor retail':>13} | {'Sale/mes ret':>12}"
print(hdr)
print("-" * len(hdr))
for r in rows:
    rot = f"{float(r['rot_ponderada_meses']):.1f}m" if r['rot_ponderada_meses'] else "inf"
    sale = float(r['salida_mensual_retail'] or 0)
    print(f"{r['status']:15s} | {r['arts']:>5} | {int(r['uds_stock']):>10,} | {int(r['uds_vendidas_12m']):>10,} | {int(r['uds_proyectadas_anual_wma']):>10,} | {rot:>10} | ${float(r['valor_retail']):>12,.0f} | ${sale:>11,.0f}")

# ===== 2. ACTIVE deep dive =====
active = next((r for r in rows if r['status'] == 'ACTIVE'), None)
if active:
    rot = float(active['rot_ponderada_meses'] or 0)
    sale_mes = float(active['salida_mensual_retail'] or 0)
    print()
    print("=" * 90)
    print(f"ACTIVOS: {active['arts']} articulos que REALMENTE rotan")
    print("=" * 90)
    print(f"  Stock actual:              {int(active['uds_stock']):>10,} unidades")
    print(f"  Vendido en 12m:            {int(active['uds_vendidas_12m']):>10,} unidades")
    print(f"  Proyeccion anual (WMA):    {int(active['uds_proyectadas_anual_wma']):>10,} unidades")
    print(f"  Rotacion ponderada (WMA):  {rot:>10.1f} meses")
    print(f"  Valor retail en stock:     ${float(active['valor_retail']):>12,.0f}")
    print(f"  Salida mensual (retail):   ${sale_mes:>12,.0f}/mes")
    print()
    print(f"  COLCHON DE REPOSICION (solo activos):")
    print(f"    Salida mensual FOB (~18%):  ${sale_mes * 0.18:>10,.0f}/mes")
    print(f"    Salida mensual CIF (~27%):  ${sale_mes * 0.27:>10,.0f}/mes")
    print(f"    Stock actual cubre {rot:.0f} meses de venta a ritmo WMA")
    print(f"    Para reponer 3 meses de activos a CIF: ${sale_mes * 0.27 * 3:>10,.0f}")
    print(f"    Para reponer 6 meses de activos a CIF: ${sale_mes * 0.27 * 6:>10,.0f}")

# ===== 3. Top 15 fastest movers =====
print()
print("=" * 90)
print("TOP 15 ARTICULOS MAS RAPIDOS (menor rotacion = salen rapido)")
print("=" * 90)
cur.execute("""
WITH article_wma AS (
  SELECT soi.article_id,
         SUM(soi.quantity) / 12.0 AS avg_simple,
         SUM(CASE WHEN i.invoice_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '3 months')
                  THEN soi.quantity * 2.0 ELSE soi.quantity END) / 15.0 AS avg_wma
  FROM sales_order_items soi
  JOIN sales_orders so ON soi.sales_order_id = so.id
  JOIN invoices i ON i.sales_order_id = so.id
  WHERE i.is_cancelled = false AND i.deleted_at IS NULL AND so.deleted_at IS NULL
    AND i.invoice_date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '12 months')
    AND i.invoice_date < date_trunc('month', CURRENT_DATE)
  GROUP BY soi.article_id
  HAVING SUM(soi.quantity) / 12.0 >= 5
)
SELECT a.code, a.description, a.stock::int,
       aw.avg_wma::numeric(10,1) AS vta_mes_wma,
       (a.stock / NULLIF(aw.avg_wma, 0))::numeric(10,1) AS meses_stock,
       a.unit_price,
       (a.stock * a.unit_price)::numeric(12,0) AS valor_retail,
       (aw.avg_wma * a.unit_price)::numeric(10,0) AS salida_mes_retail
FROM articles a
JOIN article_wma aw ON aw.article_id = a.id
WHERE a.deleted_at IS NULL AND a.is_active = true AND a.stock > 0
ORDER BY a.stock / NULLIF(aw.avg_wma, 0) ASC
LIMIT 15
""")
print(f"  {'Codigo':15s} {'Stock':>7} {'Vta/mes':>8} {'Meses':>7} {'Sale/mes':>9}  Descripcion")
print("  " + "-" * 75)
for r in cur.fetchall():
    m = float(r['meses_stock'] or 0)
    alert = " !!" if m < 6 else " !" if m < 12 else ""
    print(f"  {r['code']:15s} {r['stock']:>7,} {float(r['vta_mes_wma']):>8.1f} {m:>6.1f}m{alert} ${float(r['salida_mes_retail']):>8,.0f}  {(r['description'] or '')[:30]}")

# ===== 4. Summary for break-even colchon =====
print()
print("=" * 90)
print("RESUMEN: COLCHON NECESARIO PARA LA MERCADERIA PAPA CALIENTE")
print("=" * 90)
if active:
    rot = float(active['rot_ponderada_meses'] or 0)
    sale_mes_cif = float(active['salida_mensual_retail'] or 0) * 0.27
    print(f"  Solo los ACTIVOS ({active['arts']} articulos) que realmente rotan:")
    print(f"    Salen del deposito:      ${sale_mes_cif:,.0f}/mes a costo CIF x1.5")
    print(f"    Stock actual cubre:      {rot:.0f} meses de venta (WMA)")
    if rot > 12:
        print(f"    Estado:                  SOBRADO - no necesitas importar activos por {rot:.0f} meses")
        print(f"    Colchon adicional:       $0 (ya tenes de sobra)")
    elif rot > 6:
        print(f"    Estado:                  OK - tenes {rot:.0f} meses de cobertura")
        print(f"    Colchon recomendado:     ${sale_mes_cif * 3:,.0f} (3 meses de CIF)")
    else:
        print(f"    Estado:                  BAJO - solo {rot:.0f} meses, hay que importar pronto")
        print(f"    Colchon urgente:         ${sale_mes_cif * 6:,.0f} (6 meses de CIF)")

conn.close()
