/**
 * Script: Analyze "active stock period" trends for articles.
 *
 * Since stock_movements is empty, we infer stock availability from sales:
 * - If an article had sales in a month, it had stock.
 * - If it has stock now, it's still active.
 * - The "active period" = from first month with sales to last month with sales (or current if stock > 0).
 * - Months with 0 sales inside the active period are included (stock existed but didn't sell).
 * - Months with 0 sales OUTSIDE (before first sale or after stock ran out) are excluded.
 *
 * Usage:  npx tsx scripts/analyze-active-stock-trends.ts [months]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MONTHS_TO_SHOW = parseInt(process.argv[2] || '12');

interface MonthInfo {
  year: number;
  month: number;
  label: string;
  key: string;
  startDate: Date;
  endDate: Date;
}

async function main() {
  console.log(`Analyzing active stock trends for last ${MONTHS_TO_SHOW} months...\n`);

  // 1. Generate month array
  const today = new Date();
  const monthsArray: MonthInfo[] = [];
  for (let i = MONTHS_TO_SHOW - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    monthsArray.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      label: date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      key: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
      startDate: date,
      endDate,
    });
  }

  // 2. Get all articles with current stock
  const articles = await prisma.articles.findMany({
    where: { deleted_at: null, is_active: true },
    select: { id: true, code: true, description: true, stock: true },
  });

  // 3. Get sales data per month
  const salesMap = new Map<string, Map<string, number>>();
  for (const monthData of monthsArray) {
    const salesData = await prisma.$queryRaw<Array<{ article_id: bigint; total_quantity: number }>>`
      SELECT
        soi.article_id,
        SUM(soi.quantity) as total_quantity
      FROM sales_order_items soi
      INNER JOIN sales_orders so ON soi.sales_order_id = so.id
      INNER JOIN invoices i ON i.sales_order_id = so.id
      WHERE i.is_printed = true
        AND i.is_cancelled = false
        AND i.invoice_date >= ${monthData.startDate}
        AND i.invoice_date <= ${monthData.endDate}
        AND so.deleted_at IS NULL
        AND i.deleted_at IS NULL
      GROUP BY soi.article_id
    `;
    for (const item of salesData) {
      const artId = item.article_id.toString();
      if (!salesMap.has(artId)) salesMap.set(artId, new Map());
      salesMap.get(artId)!.set(monthData.key, Number(item.total_quantity || 0));
    }
  }

  // 4. For each article, find active period and compute trends
  const results: Array<{
    code: string;
    description: string;
    currentStock: number;
    totalMonths: number;
    activeMonths: number;
    fullTrend: number[];
    activeTrend: number[];
    activeLabels: string[];
    avgFull: number;
    avgActive: number;
  }> = [];

  for (const article of articles) {
    const artId = article.id.toString();
    const currentStock = Number(article.stock);
    const artSales = salesMap.get(artId);

    // Build full sales trend
    const fullTrend = monthsArray.map((m) => artSales?.get(m.key) || 0);
    const totalSales = fullTrend.reduce((s, v) => s + v, 0);
    if (totalSales === 0) continue; // No sales at all

    // Find active period:
    // - First month with sales (stock was available from at least here)
    // - Last month: either last month with sales, or current month if stock > 0
    let firstSaleIdx = -1;
    let lastSaleIdx = -1;

    for (let i = 0; i < fullTrend.length; i++) {
      if (fullTrend[i] > 0) {
        if (firstSaleIdx === -1) firstSaleIdx = i;
        lastSaleIdx = i;
      }
    }

    if (firstSaleIdx === -1) continue;

    // If article currently has stock, extend active period to current month
    let activeEnd = lastSaleIdx;
    if (currentStock > 0) {
      activeEnd = fullTrend.length - 1;
    }

    const activeStart = firstSaleIdx;
    const activeTrend = fullTrend.slice(activeStart, activeEnd + 1);
    const activeLabels = monthsArray.slice(activeStart, activeEnd + 1).map((m) => m.label);
    const activeMonths = activeTrend.length;

    // Only include if active period is different from full period
    if (activeMonths >= MONTHS_TO_SHOW) continue;

    const avgFull = totalSales / MONTHS_TO_SHOW;
    const avgActive = activeMonths > 0 ? activeTrend.reduce((s, v) => s + v, 0) / activeMonths : 0;

    results.push({
      code: article.code,
      description: article.description,
      currentStock,
      totalMonths: MONTHS_TO_SHOW,
      activeMonths,
      fullTrend,
      activeTrend,
      activeLabels,
      avgFull,
      avgActive,
    });
  }

  // Sort by biggest difference in average
  results.sort((a, b) => b.avgActive - b.avgFull - (a.avgActive - a.avgFull));

  // Print report
  console.log(
    `${'CODE'.padEnd(15)} ${'DESCRIPTION'.padEnd(40)} ${'STOCK'.padStart(6)} ${'TOT'.padStart(4)} ${'ACT'.padStart(4)} ${'PROM.FULL'.padStart(10)} ${'PROM.ACT'.padStart(10)} ${'PERIODO ACTIVO'}`
  );
  console.log('-'.repeat(120));

  for (const r of results.slice(0, 80)) {
    console.log(
      `${r.code.padEnd(15)} ${r.description.substring(0, 38).padEnd(40)} ${String(r.currentStock).padStart(6)} ${String(r.totalMonths).padStart(4)} ${String(r.activeMonths).padStart(4)} ${r.avgFull.toFixed(1).padStart(10)} ${r.avgActive.toFixed(1).padStart(10)} ${r.activeLabels[0]} - ${r.activeLabels[r.activeLabels.length - 1]}`
    );
  }

  console.log(`\nTotal articles with shorter active period: ${results.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
