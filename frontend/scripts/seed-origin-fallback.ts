/**
 * Fills import_origin for articles still UNKNOWN (null) using the size rule, so
 * the container planner stops leaking India-only items that were never quoted
 * (e.g. CRC9012, a 12" R.C. codo).
 *
 *   npx tsx scripts/seed-origin-fallback.ts            # dry-run report
 *   npx tsx scripts/seed-origin-fallback.ts --apply    # write (only NULLs)
 *
 * Rule (same one the planner's blockedOrigins filter uses):
 *   medio (2"–12") butt-weld codo/tee/casquete  -> 'india'
 *   everything else                              -> 'china'
 * Only touches import_origin IS NULL, so proforma-derived tags are never changed.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// medio butt-weld codo/tee/casquete (NOT reductions). Mirrors containerFill.
const MEDIO_BUTTWELD = `category_id = 1
  AND (description LIKE 'Codo%' OR description LIKE 'Tee STD%' OR description LIKE 'Tee XS%'
       OR description LIKE 'Tee E.P%' OR description LIKE 'Casquete%')
  AND description NOT LIKE '%Reducción%' AND description NOT LIKE 'Tee de Red%'
  AND description ~ ' de (2|2 1/2|3|4|5|6|8|10|12)"'`;

async function main() {
  console.log(`\n=== seed-origin-fallback (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const before = await prisma.$queryRawUnsafe<Array<{ origin: string; n: bigint }>>(
    `SELECT COALESCE(import_origin,'unknown') origin, count(*) n
     FROM articles WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1`
  );
  console.log('Before:', Object.fromEntries(before.map((r) => [r.origin, Number(r.n)])));

  const willIndia = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) n FROM articles WHERE import_origin IS NULL AND deleted_at IS NULL AND ${MEDIO_BUTTWELD}`
  );
  const willChina = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*) n FROM articles WHERE import_origin IS NULL AND deleted_at IS NULL AND NOT (${MEDIO_BUTTWELD})`
  );
  console.log(
    `Unknown → india: ${Number(willIndia[0].n)}   Unknown → china: ${Number(willChina[0].n)}`
  );

  const sample = await prisma.$queryRawUnsafe<Array<{ code: string; description: string }>>(
    `SELECT code, description FROM articles
     WHERE import_origin IS NULL AND deleted_at IS NULL AND ${MEDIO_BUTTWELD} ORDER BY code LIMIT 15`
  );
  console.log('\nSample of unknown→india (medio codos/tees/casquetes):');
  for (const s of sample) console.log(`  ${s.code.padEnd(12)} ${s.description}`);

  if (APPLY) {
    const india = await prisma.$executeRawUnsafe(
      `UPDATE articles SET import_origin = 'india' WHERE import_origin IS NULL AND deleted_at IS NULL AND ${MEDIO_BUTTWELD}`
    );
    const china = await prisma.$executeRawUnsafe(
      `UPDATE articles SET import_origin = 'china' WHERE import_origin IS NULL AND deleted_at IS NULL`
    );
    console.log(`\nApplied: india=${india}  china=${china}`);
    const after = await prisma.$queryRawUnsafe<Array<{ origin: string; n: bigint }>>(
      `SELECT COALESCE(import_origin,'unknown') origin, count(*) n
       FROM articles WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 1`
    );
    console.log('After:', Object.fromEntries(after.map((r) => [r.origin, Number(r.n)])));
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
