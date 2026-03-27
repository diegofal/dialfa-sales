import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Replicate the logic from calculateActiveStockTrends
  const monthsToShow = 12;

  const allSales = await prisma.$queryRaw<
    Array<{ article_id: bigint; month: string; qty: number }>
  >`
    SELECT
      soi.article_id,
      TO_CHAR(i.invoice_date, 'YYYY-MM') as month,
      SUM(soi.quantity) as qty
    FROM sales_order_items soi
    INNER JOIN sales_orders so ON soi.sales_order_id = so.id
    INNER JOIN invoices i ON i.sales_order_id = so.id
    WHERE i.is_printed = true
      AND i.is_cancelled = false
      AND so.deleted_at IS NULL
      AND i.deleted_at IS NULL
    GROUP BY soi.article_id, TO_CHAR(i.invoice_date, 'YYYY-MM')
    ORDER BY soi.article_id, month
  `;

  // Group by article
  const articleSales = new Map<string, Map<string, number>>();
  for (const row of allSales) {
    const artId = row.article_id.toString();
    if (!articleSales.has(artId)) articleSales.set(artId, new Map());
    articleSales.get(artId)!.set(row.month, Number(row.qty));
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
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
  }

  // Test E7/8X8 (id 1200)
  const testIds = ['1200'];
  const artCodes: Record<string, string> = { '1200': 'E7/8X8' };

  // Also get a few articles with many sales months
  const topArticles = Array.from(articleSales.entries())
    .map(([id, months]) => ({ id, monthCount: months.size }))
    .sort((a, b) => b.monthCount - a.monthCount)
    .slice(0, 5);

  for (const { id } of topArticles) {
    if (!testIds.includes(id)) testIds.push(id);
  }

  // Get codes for display
  const artRows = await prisma.articles.findMany({
    where: { id: { in: testIds.map(BigInt) } },
    select: { id: true, code: true },
  });
  for (const a of artRows) {
    artCodes[a.id.toString()] = a.code;
  }

  for (const artId of testIds) {
    const salesByMonth = articleSales.get(artId);
    if (!salesByMonth) {
      console.log(artCodes[artId], ': no sales');
      continue;
    }

    const months = Array.from(salesByMonth.keys()).sort();
    const [firstY, firstM] = months[0].split('-').map(Number);
    const [lastY, lastM] = months[months.length - 1].split('-').map(Number);
    const totalSpan = (lastY - firstY) * 12 + (lastM - firstM) + 1;

    if (totalSpan < monthsToShow) {
      console.log(artCodes[artId], `: history too short (${totalSpan} months)`);
      continue;
    }

    let bestScore = 0,
      bestQty = 0,
      bestStartY = firstY,
      bestStartM = firstM;

    for (let w = 0; w <= totalSpan - monthsToShow; w++) {
      const d = new Date(firstY, firstM - 1 + w, 1);
      const wY = d.getFullYear();
      const wM = d.getMonth() + 1;
      const windowKeys = generateMonthKeys(wY, wM, monthsToShow);

      let activeCount = 0,
        totalQty = 0;
      for (const key of windowKeys) {
        const qty = salesByMonth.get(key) || 0;
        if (qty > 0) activeCount++;
        totalQty += qty;
      }

      if (activeCount > bestScore || (activeCount === bestScore && totalQty > bestQty)) {
        bestScore = activeCount;
        bestQty = totalQty;
        bestStartY = wY;
        bestStartM = wM;
      }
    }

    const bestKeys = generateMonthKeys(bestStartY, bestStartM, monthsToShow);
    const bestLabels = bestKeys.map(monthKeyToLabel);
    const trend = bestKeys.map((k) => salesByMonth.get(k) || 0);

    console.log(`\n${artCodes[artId]} (id ${artId}):`);
    console.log(
      `  History: ${months[0]} to ${months[months.length - 1]} (${months.length} months with sales, ${totalSpan} span)`
    );
    console.log(
      `  Best ${monthsToShow}-month window: ${bestLabels[0]} - ${bestLabels[bestLabels.length - 1]}`
    );
    console.log(`  Active months in window: ${bestScore}/${monthsToShow}`);
    console.log(`  Total qty in window: ${bestQty}`);
    console.log(`  Trend: ${trend.join(', ')}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
