/**
 * Analyze the current draft supplier order using both current WMA
 * and active trend (best historical period) WMA.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MONTHS = 24;

function calcWMA(trend: number[]): number {
  if (!trend || trend.length === 0) return 0;
  let weightSum = 0;
  let valueSum = 0;
  for (let i = 0; i < trend.length; i++) {
    const weight = i + 1;
    valueSum += trend[i] * weight;
    weightSum += weight;
  }
  return weightSum > 0 ? valueSum / weightSum : 0;
}

function generateMonthKeys(startYear: number, startMonth: number, count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startYear, startMonth - 1 + i, 1);
    keys.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
  }
  return keys;
}

function monthKeyToLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
}

async function main() {
  // 1. Get draft
  const draft = await prisma.supplier_orders.findFirst({
    where: { status: 'draft', deleted_at: null },
    include: { supplier_order_items: true },
    orderBy: { updated_at: 'desc' },
  });
  if (!draft) {
    console.log('No draft');
    return;
  }

  const artIds = draft.supplier_order_items.map((i) => i.article_id);

  // 2. Get articles
  const articles = await prisma.articles.findMany({
    where: { id: { in: artIds } },
    select: { id: true, code: true, stock: true },
  });
  const artMap = new Map<string, { code: string; stock: number }>();
  articles.forEach((a) => artMap.set(a.id.toString(), { code: a.code, stock: Number(a.stock) }));

  // 3. Get ALL sales history (all articles - simpler than filtering)
  const allSales = await prisma.$queryRaw<
    Array<{ article_id: bigint; month: string; qty: number }>
  >`
    SELECT soi.article_id, TO_CHAR(i.invoice_date, 'YYYY-MM') as month, SUM(soi.quantity) as qty
    FROM sales_order_items soi
    INNER JOIN sales_orders so ON soi.sales_order_id = so.id
    INNER JOIN invoices i ON i.sales_order_id = so.id
    WHERE i.is_printed = true AND i.is_cancelled = false
      AND so.deleted_at IS NULL AND i.deleted_at IS NULL
    GROUP BY soi.article_id, TO_CHAR(i.invoice_date, 'YYYY-MM')
  `;

  // Group by article
  const salesByArt = new Map<string, Map<string, number>>();
  for (const row of allSales) {
    const id = row.article_id.toString();
    if (!salesByArt.has(id)) salesByArt.set(id, new Map());
    salesByArt.get(id)!.set(row.month, Number(row.qty));
  }

  // 4. Current period sales (last MONTHS months)
  const today = new Date();
  const currentKeys: string[] = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    currentKeys.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
  }

  // 5. Analyze each item
  const rows: Array<{
    code: string;
    qty: number;
    stock: number;
    wma: number;
    est: number;
    actWma: number;
    actEst: number;
    actPeriod: string;
    actActive: number;
  }> = [];

  for (const item of draft.supplier_order_items) {
    const artId = item.article_id.toString();
    const art = artMap.get(artId);
    if (!art) continue;

    const qty = Number(item.quantity);
    const salesMap = salesByArt.get(artId) || new Map();

    // Current trend
    const currentTrend = currentKeys.map((k) => salesMap.get(k) || 0);
    const wma = calcWMA(currentTrend);
    const est = wma > 0 ? qty / wma : Infinity;

    // Best historical window
    const months = Array.from(salesMap.keys()).sort();
    let actWma = 0;
    let actEst = Infinity;
    let actPeriod = '-';
    let actActive = 0;

    if (months.length > 0) {
      const [firstY, firstM] = months[0].split('-').map(Number);
      const [lastY, lastM] = months[months.length - 1].split('-').map(Number);
      const span = (lastY - firstY) * 12 + (lastM - firstM) + 1;

      if (span >= MONTHS) {
        let bestScore = 0,
          bestQty = 0,
          bestSY = firstY,
          bestSM = firstM;
        for (let w = 0; w <= span - MONTHS; w++) {
          const d = new Date(firstY, firstM - 1 + w, 1);
          const wY = d.getFullYear();
          const wM = d.getMonth() + 1;
          const wKeys = generateMonthKeys(wY, wM, MONTHS);
          let ac = 0,
            tq = 0;
          for (const k of wKeys) {
            const q = salesMap.get(k) || 0;
            if (q > 0) ac++;
            tq += q;
          }
          if (ac > bestScore || (ac === bestScore && tq > bestQty)) {
            bestScore = ac;
            bestQty = tq;
            bestSY = wY;
            bestSM = wM;
          }
        }
        const bestKeys = generateMonthKeys(bestSY, bestSM, MONTHS);
        const bestTrend = bestKeys.map((k) => salesMap.get(k) || 0);
        actWma = calcWMA(bestTrend);
        actEst = actWma > 0 ? qty / actWma : Infinity;
        actPeriod =
          monthKeyToLabel(bestKeys[0]) + '-' + monthKeyToLabel(bestKeys[bestKeys.length - 1]);
        actActive = bestScore;
      }
    }

    rows.push({
      code: art.code,
      qty,
      stock: art.stock,
      wma,
      est,
      actWma,
      actEst,
      actPeriod,
      actActive,
    });
  }

  rows.sort(
    (a, b) =>
      (a.actEst === Infinity ? 999999 : a.actEst) - (b.actEst === Infinity ? 999999 : b.actEst)
  );

  console.log(
    `CODE            QTY    STOCK  WMA${MONTHS}  EST.${MONTHS}m  ACT.WMA  EST.ACT  ACT.MONTHS  PERIOD                FLAG`
  );
  console.log('-'.repeat(125));

  for (const r of rows) {
    const e1 = isFinite(r.est) ? r.est.toFixed(0) + 'm' : 'INF';
    const e2 = isFinite(r.actEst) ? r.actEst.toFixed(0) + 'm' : 'INF';
    let flag = '';
    if (!isFinite(r.actEst) && !isFinite(r.est)) flag = '⚠ NO HISTORY';
    else if (!isFinite(r.est) && isFinite(r.actEst)) flag = '✓ RECOVERED';
    else if (isFinite(r.actEst) && r.actEst <= 12) flag = '✓ GREAT';
    else if (isFinite(r.actEst) && r.actEst <= 24) flag = '✓ GOOD';
    else if (isFinite(r.actEst) && r.actEst <= 60) flag = '~ OK';
    else if (isFinite(r.actEst) && r.actEst > 60) flag = '⚠ SLOW';
    if (r.stock > r.qty) flag += ' | stock>order';

    console.log(
      r.code.padEnd(14),
      String(r.qty).padStart(6),
      String(r.stock).padStart(7),
      r.wma.toFixed(1).padStart(6),
      e1.padStart(8),
      r.actWma.toFixed(1).padStart(8),
      e2.padStart(8),
      (r.actActive + '/' + MONTHS).padStart(10),
      r.actPeriod.padEnd(22),
      flag
    );
  }

  const recovered = rows.filter((r) => !isFinite(r.est) && isFinite(r.actEst));
  const great = rows.filter((r) => isFinite(r.actEst) && r.actEst <= 12);
  const good = rows.filter((r) => isFinite(r.actEst) && r.actEst > 12 && r.actEst <= 24);
  const ok = rows.filter((r) => isFinite(r.actEst) && r.actEst > 24 && r.actEst <= 60);
  const slow = rows.filter((r) => isFinite(r.actEst) && r.actEst > 60);
  const noData = rows.filter((r) => !isFinite(r.actEst));

  console.log('\n=== SUMMARY ===');
  console.log(
    'Total:',
    rows.length,
    '| Qty:',
    rows.reduce((s, r) => s + r.qty, 0)
  );
  console.log(
    'Recovered (was INF → now estimated):',
    recovered.length,
    '→',
    recovered.reduce((s, r) => s + r.qty, 0),
    'uds'
  );
  console.log(
    'Great (≤1yr active est.):',
    great.length,
    '→',
    great.reduce((s, r) => s + r.qty, 0),
    'uds'
  );
  console.log(
    'Good (1-2yr):',
    good.length,
    '→',
    good.reduce((s, r) => s + r.qty, 0),
    'uds'
  );
  console.log(
    'OK (2-5yr):',
    ok.length,
    '→',
    ok.reduce((s, r) => s + r.qty, 0),
    'uds'
  );
  console.log(
    'Slow (>5yr):',
    slow.length,
    '→',
    slow.reduce((s, r) => s + r.qty, 0),
    'uds'
  );
  console.log(
    'No history:',
    noData.length,
    '→',
    noData.reduce((s, r) => s + r.qty, 0),
    'uds'
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
