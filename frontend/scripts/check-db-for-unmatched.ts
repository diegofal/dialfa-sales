/**
 * Quick DB lookups for the canonical types that didn't match.
 * Tells us whether the article truly doesn't exist or whether
 * the matcher just failed to find it for another reason.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Check if W.N.R.F., REDUCER_ECCENTRIC, REDUCER_TEE, SORF series 600,
  // TEE BSPT series 2000, ELBOW_90_LR exist at all
  const queries: Array<{ label: string; where: object }> = [
    { label: 'W.N.R.F. (any)', where: { type: 'W.N.R.F.' } },
    { label: 'W.N.R.F. thickness=80', where: { type: 'W.N.R.F.', thickness: '80' } },
    { label: 'W.N.R.F. thickness=40', where: { type: 'W.N.R.F.', thickness: '40' } },
    { label: 'REDUCER_ECCENTRIC (any)', where: { type: 'REDUCER_ECCENTRIC' } },
    { label: 'REDUCER_TEE (any)', where: { type: 'REDUCER_TEE' } },
    { label: 'REDUCER_TEE thickness=STD', where: { type: 'REDUCER_TEE', thickness: 'STD' } },
    { label: 'TEE BSPT (any)', where: { type: 'TEE BSPT' } },
    { label: 'TEE BSPT series=2000', where: { type: 'TEE BSPT', series: 2000 } },
    { label: 'SORF series=600', where: { type: 'SORF', series: 600 } },
    { label: 'SORF series=600 size="1 1/4"', where: { type: 'SORF', series: 600, size: '1 1/4' } },
    { label: 'ELBOW_90_LR (any)', where: { type: 'ELBOW_90_LR' } },
    { label: 'Stud bolt, A193-B7', where: { type: 'Stud bolt, A193-B7' } },
    { label: 'Heavy Nuts, A194-2H', where: { type: 'Heavy Nuts, A194-2H' } },
    { label: 'THREADED (any)', where: { type: 'THREADED' } },
  ];

  console.log(`${'label'.padEnd(40)} count`);
  console.log(`${''.padEnd(45, '-')}`);
  for (const q of queries) {
    const count = await prisma.articles.count({
      where: { ...q.where, deleted_at: null, is_active: true },
    });
    console.log(`${q.label.padEnd(40)} ${count.toString().padStart(5)}`);
  }

  // For W.N.R.F. show the available thickness values
  const wnrfThicknesses = await prisma.articles.groupBy({
    by: ['thickness'],
    where: { type: 'W.N.R.F.', deleted_at: null, is_active: true },
    _count: true,
  });
  console.log(`\nW.N.R.F. thickness distribution:`);
  for (const t of wnrfThicknesses) {
    console.log(`  thickness="${t.thickness ?? '(null)'}"  count=${t._count}`);
  }

  // SORF series 600 sizes
  const sorf600 = await prisma.articles.findMany({
    where: { type: 'SORF', series: 600, deleted_at: null, is_active: true },
    select: { code: true, size: true },
    orderBy: { size: 'asc' },
  });
  console.log(`\nSORF series 600 sizes available: ${sorf600.length}`);
  console.log(`  ${sorf600.map((a) => `${a.size}=${a.code}`).join(', ')}`);

  // TEE BSPT series 2000 sizes
  const teeBspt2000 = await prisma.articles.findMany({
    where: { type: 'TEE BSPT', series: 2000, deleted_at: null, is_active: true },
    select: { code: true, size: true },
    orderBy: { size: 'asc' },
  });
  console.log(`\nTEE BSPT series 2000 sizes available: ${teeBspt2000.length}`);
  if (teeBspt2000.length > 0) {
    console.log(`  ${teeBspt2000.map((a) => `${a.size}=${a.code}`).join(', ')}`);
  }

  // REDUCER_TEE distribution by series/thickness
  const redTee = await prisma.articles.groupBy({
    by: ['series', 'thickness'],
    where: { type: 'REDUCER_TEE', deleted_at: null, is_active: true },
    _count: true,
  });
  console.log(`\nREDUCER_TEE distribution:`);
  for (const r of redTee) {
    console.log(
      `  series=${r.series ?? '(null)'} thickness="${r.thickness ?? '(null)'}" count=${r._count}`
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
