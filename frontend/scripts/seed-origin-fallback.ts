/**
 * Tags the medio (2"–12") butt-weld codos/tees/casquetes that are still UNKNOWN
 * as 'india', so the container planner stops leaking India-only items that were
 * never quoted in a proforma (e.g. CRC9012, a 12" R.C. codo).
 *
 *   npx tsx scripts/seed-origin-fallback.ts            # dry-run report
 *   npx tsx scripts/seed-origin-fallback.ts --apply    # write (only NULLs)
 *
 * We ONLY tag what we're confident about (India = medio butt-weld fittings).
 * Everything else stays NULL/unknown — we don't guess that it's China. Unknown
 * items still pass the planner's blockedOrigins filter; this just makes sure the
 * medio codos/tees we know are India get blocked. Only touches import_origin IS
 * NULL, so proforma-derived tags are never changed.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// medio butt-weld codo/tee/casquete (NOT reductions). Mirrors containerFill's filter.
const MEDIO_BUTTWELD = `category_id = 1
  AND (description LIKE 'Codo%' OR description LIKE 'Tee STD%' OR description LIKE 'Tee XS%'
       OR description LIKE 'Tee E.P%' OR description LIKE 'Casquete%')
  AND description NOT LIKE '%Reducción%' AND description NOT LIKE 'Tee de Red%'
  AND description ~ ' de (2|2 1/2|3|4|5|6|8|10|12)"'`;

async function counts() {
  const rows = await prisma.$queryRawUnsafe<Array<{ origin: string; n: bigint }>>(
    `SELECT COALESCE(import_origin,'unknown') origin, count(*) n
     FROM articles WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1`
  );
  return Object.fromEntries(rows.map((r) => [r.origin, Number(r.n)]));
}

async function main() {
  console.log(`\n=== seed-origin-fallback (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);
  console.log('Before:', await counts());

  const willIndia = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) n FROM articles WHERE import_origin IS NULL AND deleted_at IS NULL AND ${MEDIO_BUTTWELD}`
  );
  console.log(`\nUnknown medio butt-weld → india: ${Number(willIndia[0].n)} (rest stays unknown)`);

  const sample = await prisma.$queryRawUnsafe<Array<{ code: string; description: string }>>(
    `SELECT code, description FROM articles
     WHERE import_origin IS NULL AND deleted_at IS NULL AND ${MEDIO_BUTTWELD} ORDER BY code LIMIT 15`
  );
  console.log('Sample:');
  for (const s of sample) console.log(`  ${s.code.padEnd(12)} ${s.description}`);

  if (APPLY) {
    const india = await prisma.$executeRawUnsafe(
      `UPDATE articles SET import_origin = 'india' WHERE import_origin IS NULL AND deleted_at IS NULL AND ${MEDIO_BUTTWELD}`
    );
    console.log(`\nApplied: ${india} → india`);
    console.log('After:', await counts());
  } else {
    console.log('\nDry-run only — re-run with --apply to write.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
