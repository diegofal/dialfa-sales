/**
 * Script: Check status of specific articles (T3RN4 and "espárragos") and optionally
 * reactivate them if they are inactive.
 *
 * Read-only by default. Pass `--activate` to set is_active = true on inactive matches.
 *
 * Usage:
 *   npx tsx scripts/check-articles-status.ts             # report only
 *   npx tsx scripts/check-articles-status.ts --activate  # report + reactivate inactives
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_CODES = ['T3RN4'];
const TARGET_DESCRIPTION_KEYWORDS = ['esparrago', 'espárrago', 'esparragos', 'espárragos'];

interface MatchedArticle {
  id: bigint;
  code: string;
  description: string;
  is_active: boolean;
  deleted_at: Date | null;
}

function fmt(article: MatchedArticle): string {
  const status = article.deleted_at ? 'DELETED' : article.is_active ? 'ACTIVE' : 'INACTIVE';
  return `  id:${String(article.id).padStart(6)} | ${article.code.padEnd(20)} | ${status.padEnd(9)} | ${article.description}`;
}

async function main() {
  const shouldActivate = process.argv.includes('--activate');

  console.log('='.repeat(80));
  console.log('CHECK ARTICLES STATUS — T3RN4 + espárragos');
  console.log('='.repeat(80));

  const byCode = await prisma.articles.findMany({
    where: {
      OR: TARGET_CODES.map((c) => ({ code: { contains: c, mode: 'insensitive' as const } })),
    },
    select: { id: true, code: true, description: true, is_active: true, deleted_at: true },
    orderBy: { code: 'asc' },
  });

  const byDescription = await prisma.articles.findMany({
    where: {
      OR: TARGET_DESCRIPTION_KEYWORDS.map((k) => ({
        description: { contains: k, mode: 'insensitive' as const },
      })),
    },
    select: { id: true, code: true, description: true, is_active: true, deleted_at: true },
    orderBy: { code: 'asc' },
  });

  console.log('');
  console.log(`Matches by code (${TARGET_CODES.join(', ')}): ${byCode.length}`);
  byCode.forEach((a: MatchedArticle) => console.log(fmt(a)));

  console.log('');
  console.log(
    `Matches by description (${TARGET_DESCRIPTION_KEYWORDS.join(', ')}): ${byDescription.length}`
  );
  byDescription.forEach((a: MatchedArticle) => console.log(fmt(a)));

  const allMatches: MatchedArticle[] = [...byCode, ...byDescription];
  const inactiveOnly = allMatches.filter(
    (a: MatchedArticle) => !a.is_active && a.deleted_at === null
  );

  console.log('');
  console.log(`Inactive (not soft-deleted) candidates: ${inactiveOnly.length}`);

  if (inactiveOnly.length === 0) {
    console.log('Nothing to reactivate.');
    await prisma.$disconnect();
    return;
  }

  if (!shouldActivate) {
    console.log('Re-run with --activate to set is_active = true on these.');
    await prisma.$disconnect();
    return;
  }

  const ids = inactiveOnly.map((a) => a.id);
  const result = await prisma.articles.updateMany({
    where: { id: { in: ids } },
    data: { is_active: true, updated_at: new Date() },
  });

  console.log('');
  console.log(`Reactivated ${result.count} article(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
