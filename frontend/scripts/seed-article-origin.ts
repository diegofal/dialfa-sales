/**
 * Seeds `suppliers.country` and `articles.import_origin` for the container
 * planner's sourcing filter (which articles we can import right now).
 *
 *   npx tsx scripts/seed-article-origin.ts             # dry-run report (no writes)
 *   npx tsx scripts/seed-article-origin.ts --apply     # fill where import_origin is NULL
 *   npx tsx scripts/seed-article-origin.ts --apply --overwrite   # also overwrite existing
 *
 * Origin is DERIVED from proforma history by proforma_number prefix (the
 * reliable signal — supplier_id on old orders is mostly null):
 *   PIF*  -> China (Qingdao / Bestflow)
 *   CMPL* -> India (Citizen)
 * Appears in both -> 'both'; in neither -> left untouched (stays NULL = unknown).
 * `import_origin` is an editable override, so by default we only fill NULLs.
 *
 * Production DB — run the dry-run first, always.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite');

const SUPPLIER_COUNTRY: { match: string; country: string }[] = [
  { match: 'qingdao', country: 'China' },
  { match: 'bestflow', country: 'China' },
  { match: 'citizen', country: 'India' },
];

function deriveOrigin(origins: Set<string>): 'china' | 'india' | 'both' | null {
  const china = origins.has('china');
  const india = origins.has('india');
  if (china && india) return 'both';
  if (china) return 'china';
  if (india) return 'india';
  return null;
}

async function main() {
  console.log(
    `\n=== seed-article-origin (${APPLY ? 'APPLY' : 'DRY-RUN'}${OVERWRITE ? ' --overwrite' : ''}) ===\n`
  );

  // 1) Supplier countries -----------------------------------------------------
  for (const { match, country } of SUPPLIER_COUNTRY) {
    const affected = await prisma.suppliers.findMany({
      where: { name: { contains: match, mode: 'insensitive' }, deleted_at: null },
      select: { id: true, name: true, country: true },
    });
    for (const s of affected) {
      console.log(`  supplier ${s.name} -> ${country}${s.country ? ` (was ${s.country})` : ''}`);
      if (APPLY) {
        await prisma.suppliers.update({ where: { id: s.id }, data: { country } });
      }
    }
  }

  // 2) Derive article origin from proforma prefixes ---------------------------
  const rows = await prisma.$queryRaw<Array<{ article_id: bigint; origins: string }>>`
    SELECT i.article_id,
      string_agg(DISTINCT CASE
        WHEN o.proforma_number LIKE 'PIF%' THEN 'china'
        WHEN o.proforma_number LIKE 'CMPL%' THEN 'india'
      END, ',') AS origins
    FROM supplier_order_items i
    JOIN supplier_orders o ON o.id = i.supplier_order_id
    WHERE o.proforma_number LIKE 'PIF%' OR o.proforma_number LIKE 'CMPL%'
    GROUP BY i.article_id
  `;

  const tally: Record<string, number> = { china: 0, india: 0, both: 0 };
  let updated = 0;
  let skipped = 0;

  for (const r of rows) {
    const origin = deriveOrigin(new Set((r.origins ?? '').split(',').filter(Boolean)));
    if (!origin) continue;
    tally[origin]++;

    const updateWhere = OVERWRITE
      ? prisma.articles.update({ where: { id: r.article_id }, data: { import_origin: origin } })
      : prisma.$executeRaw`UPDATE articles SET import_origin = ${origin} WHERE id = ${r.article_id} AND import_origin IS NULL`;

    if (APPLY) {
      const res = await updateWhere;
      if (OVERWRITE || (typeof res === 'number' && res > 0)) updated++;
      else skipped++;
    }
  }

  // 3) Coverage report --------------------------------------------------------
  const [total, withOrigin] = await Promise.all([
    prisma.articles.count({ where: { deleted_at: null, is_active: true } }),
    prisma.articles.count({
      where: { deleted_at: null, is_active: true, import_origin: { not: null } },
    }),
  ]);

  console.log(
    `\n  Derived from proformas: china=${tally.china} india=${tally.india} both=${tally.both} (total ${rows.length} articles in proformas)`
  );
  if (APPLY) console.log(`  Applied: updated=${updated} skipped(existing)=${skipped}`);
  console.log(
    `  Catalog coverage now: ${withOrigin}/${total} active articles have import_origin\n`
  );
  console.log(APPLY ? '  Done.' : '  Dry-run only — re-run with --apply to write.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
