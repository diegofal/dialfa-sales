/**
 * Runs the REAL deterministic container planner (same code path as the hook,
 * minus React) and prints the order, for comparison against the AI-built one.
 *
 *   npx tsx scripts/run-container-planner.ts
 */
import * as ArticleService from '../lib/services/ArticleService';
import { composeContainerOrder } from '../lib/utils/articles/composeContainerOrder';
import {
  getArticleCifCost,
  getArticleDiscountedSellPrice,
} from '../lib/utils/articles/marginCalculations';
import type { Article } from '../types/article';

// The 22 codes the AI put in the last HTML container (papa-caliente, China).
const AI_SET = new Set([
  'CRL901',
  'CRL9011/4',
  'E5/8X4',
  'CRL9011/2',
  'BSS1504',
  'RC3X2',
  'CRL901/2',
  'E5/8X5',
  'CRL903/4',
  'BSS1502',
  'E5/8X31/2',
  'BSS1506',
  'BSS1503',
  'RC6X4',
  'US3RB1',
  'RC21/2X2',
  'T1/2',
  'BRS1503',
  'RC4X21/2',
  'RC4X3',
  'RC3X21/2',
  'RC5X4',
]);

async function run(label: string, strategy: any, catalog: Article[]) {
  const byId = new Map(catalog.map((a) => [a.id, a]));
  const res = composeContainerOrder({
    catalog,
    resolveArticle: (id: number) => byId.get(id),
    manualQty: new Map(),
    removedIds: new Set(),
    trendMonths: strategy.trendMonths,
    strategy,
    capacityKg: 25000,
  });
  if (!res) return console.log(`${label}: no result`);

  let kg = 0;
  let profit = 0;
  const codes: string[] = [];
  for (const e of res.entries) {
    const a = e.article;
    const w = Number(a.weightKg) || 0;
    const sell = getArticleDiscountedSellPrice(a) ?? 0;
    const cost = getArticleCifCost(a) ?? 0;
    kg += e.quantity * w;
    profit += e.quantity * (sell - cost);
    codes.push(a.code);
  }
  const overlap = codes.filter((c) => AI_SET.has(c));
  console.log(`\n=== ${label} ===`);
  console.log(
    `lines=${res.entries.length}  kg=${(kg / 1000).toFixed(1)}t  gross(list-based)=$${Math.round(profit).toLocaleString()}`
  );
  console.log(`overlap with AI 22-line set: ${overlap.length}/22  ->  ${overlap.join(', ')}`);
  console.log('top 12 lines:');
  for (const e of res.entries.slice(0, 12)) {
    console.log(
      `  ${e.article.code.padEnd(11)} x${String(e.quantity).padStart(6)}  ${(Number(e.article.weightKg) || 0).toFixed(2)}kg/u  origin=${e.article.importOrigin ?? '—'}`
    );
  }
}

async function main() {
  const asOf = new Date();
  asOf.setMonth(asOf.getMonth() - 1);
  asOf.setDate(15);

  const { data: catalog } = await ArticleService.list({
    page: 1,
    limit: 2000,
    includeTrends: true,
    trendMonths: 12,
    isActive: 'true',
    trendAsOf: asOf,
  });
  console.log(
    `catalog: ${catalog.length} active articles (trendAsOf=${asOf.toISOString().slice(0, 10)})`
  );

  const cat = catalog as unknown as Article[];

  // A) Out-of-the-box planner default.
  await run(
    'A · default (12m, exclude India)',
    {
      coverageMonths: 12,
      trendMonths: 12,
      maxStockMonths: 0,
      categoryIds: [],
      blockedOrigins: ['india'],
      minMonthsWithSales: 0,
    },
    cat
  );

  // B) Tuned toward the AI container: 24-month horizon + papa caliente.
  await run(
    'B · papa-caliente (24m, ≥8 months, exclude India)',
    {
      coverageMonths: 24,
      trendMonths: 12,
      maxStockMonths: 0,
      categoryIds: [],
      blockedOrigins: ['india'],
      minMonthsWithSales: 8,
    },
    cat
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
