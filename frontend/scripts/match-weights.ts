/**
 * Matches extracted weight-table records (scripts/output/weight-tables.json) to
 * DB articles using the SAME MatchingKeyNormalizer the proforma importer uses,
 * and reports / applies weight_kg updates.
 *
 *   npx tsx scripts/match-weights.ts              # dry-run report (no writes)
 *   npx tsx scripts/match-weights.ts --apply      # fill weight_kg where missing/zero
 *   npx tsx scripts/match-weights.ts --apply --overwrite   # also overwrite existing
 *
 * Production DB — dry-run first, always.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { MatchingKeyNormalizer as N } from '../lib/utils/priceLists/proformaImport/matching-normalizer';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite');
const OUT_DIR = path.join(__dirname, 'output');

interface WRec {
  source: string;
  block: string;
  type: string;
  series: number | null;
  thickness: string;
  size: string;
  weight: number;
}

function keyOf(
  type: string,
  series: number | null,
  thickness: string,
  size: string
): string | null {
  return N.createMatchingKey({ type, thickness, size, series: series ?? undefined });
}

async function main() {
  const recs: WRec[] = JSON.parse(
    fs.readFileSync(path.join(OUT_DIR, 'weight-tables.json'), 'utf-8')
  );

  // Build Excel key -> weight (detect collisions where same key gets different weights)
  const excelWeight = new Map<string, number>();
  const excelMeta = new Map<string, WRec>();
  const collisions: { key: string; a: WRec; b: number }[] = [];
  for (const r of recs) {
    const k = keyOf(r.type, r.series, r.thickness, r.size);
    if (!k) continue;
    if (excelWeight.has(k) && Math.abs(excelWeight.get(k)! - r.weight) > 1e-6) {
      collisions.push({ key: k, a: r, b: excelWeight.get(k)! });
    }
    excelWeight.set(k, r.weight);
    excelMeta.set(k, r);
  }

  // Load DB articles
  const articles = await prisma.articles.findMany({
    where: { deleted_at: null, is_active: true },
    select: {
      id: true,
      code: true,
      description: true,
      type: true,
      series: true,
      thickness: true,
      size: true,
      weight_kg: true,
    },
  });

  const willSet: { id: bigint; code: string; key: string; old: number | null; neu: number }[] = [];
  const conflicts: { code: string; key: string; old: number; neu: number }[] = [];
  const alreadyOk: string[] = [];
  const matchedKeys = new Set<string>();

  for (const a of articles) {
    if (!a.type || !a.size) continue;
    const k = keyOf(a.type, a.series ?? null, a.thickness ?? '', a.size);
    if (!k || !excelWeight.has(k)) continue;
    matchedKeys.add(k);
    const neu = excelWeight.get(k)!;
    const old = a.weight_kg != null ? Number(a.weight_kg) : null;
    if (old == null || old === 0) {
      willSet.push({ id: a.id, code: a.code, key: k, old, neu });
    } else if (Math.abs(old - neu) > 1e-6) {
      conflicts.push({ code: a.code, key: k, old, neu });
      if (OVERWRITE) willSet.push({ id: a.id, code: a.code, key: k, old, neu });
    } else {
      alreadyOk.push(a.code);
    }
  }

  // Excel keys that matched no DB article
  const unmatchedExcel = [...excelWeight.keys()].filter((k) => !matchedKeys.has(k));
  // DB articles still missing weight after this run
  const stillMissing = articles.filter((a) => {
    const w = a.weight_kg != null ? Number(a.weight_kg) : 0;
    if (w > 0) return false;
    const k = a.type && a.size ? keyOf(a.type, a.series ?? null, a.thickness ?? '', a.size) : null;
    return !(k && excelWeight.has(k));
  });

  // ---- report ----
  const L = (s: string) => console.log(s);
  L('='.repeat(78));
  L(`WEIGHT MATCH ${APPLY ? '(APPLY' + (OVERWRITE ? ' +OVERWRITE)' : ')') : '(DRY-RUN)'}`);
  L('='.repeat(78));
  L(`Excel weight records:        ${recs.length}  (${excelWeight.size} unique keys)`);
  L(`Active articles:             ${articles.length}`);
  L(
    `-> will SET weight (blank):  ${willSet.filter((w) => !conflicts.find((c) => c.code === w.code) || OVERWRITE).length}`
  );
  L(`-> already correct:          ${alreadyOk.length}`);
  L(
    `-> CONFLICTS (exist≠excel):  ${conflicts.length}  ${OVERWRITE ? '(will overwrite)' : '(left untouched)'}`
  );
  L(`-> Excel keys w/ no article: ${unmatchedExcel.length}`);
  L(`-> articles STILL missing:   ${stillMissing.length}`);
  if (collisions.length) L(`!! Excel key collisions:     ${collisions.length}`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'weight-match-willset.json'),
    JSON.stringify(
      willSet.map((w) => ({ ...w, id: w.id.toString() })),
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'weight-match-conflicts.json'),
    JSON.stringify(conflicts, null, 2)
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'weight-match-unmatched-excel.json'),
    JSON.stringify(
      unmatchedExcel.map((k) => ({
        key: k,
        weight: excelWeight.get(k),
        block: excelMeta.get(k)?.block,
      })),
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'weight-match-still-missing.json'),
    JSON.stringify(
      stillMissing.map((a) => ({
        code: a.code,
        type: a.type,
        series: a.series,
        thickness: a.thickness,
        size: a.size,
        description: a.description,
      })),
      null,
      2
    )
  );

  L('\nSample willSet (first 15):');
  willSet
    .slice(0, 15)
    .forEach((w) => L(`  ${w.code.padEnd(14)} ${w.key.padEnd(42)} ${w.old ?? '∅'} -> ${w.neu}`));
  if (conflicts.length) {
    L('\nSample CONFLICTS (first 15):');
    conflicts
      .slice(0, 15)
      .forEach((c) => L(`  ${c.code.padEnd(14)} ${c.key.padEnd(42)} db=${c.old}  excel=${c.neu}`));
  }
  L('\nFull lists written to scripts/output/weight-match-*.json');

  if (APPLY) {
    L('\nApplying updates...');
    let n = 0;
    for (const w of willSet) {
      await prisma.articles.update({
        where: { id: w.id },
        data: { weight_kg: w.neu, updated_at: new Date() },
      });
      n++;
    }
    L(`Applied ${n} weight updates.`);
  } else {
    L('\nDRY-RUN: no DB writes. Re-run with --apply to write.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
