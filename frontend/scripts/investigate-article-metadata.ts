/**
 * Script: Investigate articles with missing type/series/thickness metadata.
 *
 * Read-only — does NOT modify the database.
 * Outputs a report showing:
 *   1. Articles with NULL type + proposed values derived from description
 *   2. Articles with NULL series that might be incorrect (same type has articles WITH series)
 *
 * Usage:  npx tsx scripts/investigate-article-metadata.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ArticleRow {
  id: bigint;
  code: string;
  description: string;
  type: string | null;
  series: number | null;
  thickness: string | null;
  size: string | null;
}

interface Proposal {
  article: ArticleRow;
  proposedType: string;
  proposedSeries: number | null;
  proposedThickness: string | null;
}

function deriveType(desc: string): string {
  const d = desc.toUpperCase();

  // Codo 180°
  if (/CODO\s*180/i.test(d)) return 'ELBOW_180';

  // Codo 45° (E.P. or Liviano or Sch160)
  if (/CODO\s*45/i.test(d)) return '45D LR ELBOW';

  // Codo 90° R.L. (Liviano, E.P., Sch160)
  if (/CODO.*90.*R\.?L|CODO\s*R\.?L\.?\s*90/i.test(d)) return '90D LR ELBOW';

  // Brida Liviana Ciega
  if (/BRIDA.*LIVIANA.*CIEGA/i.test(d)) return 'BRIDA LIVIANA CIEGA';

  // Brida Liviana Lap Joint
  if (/BRIDA.*LIVIANA.*LAP\s*JOINT/i.test(d)) return 'BRIDA LIVIANA LAP JOINT';

  // Brida Liviana (plain)
  if (/BRIDA.*LIVIANA/i.test(d) && !/CIEGA|LAP/i.test(d)) return 'BRIDA LIVIANA';

  // Brida Lap Joint S-150
  if (/BRIDA.*LAP\s*JOINT.*S.?150|BRIDA.*L\.?J\.?.*S.?150/i.test(d)) return 'LAP JOINT';

  // Bridas DIN
  if (/BRIDA.*DIN.*BAR/i.test(d)) return 'BRIDA DIN';

  // Bridas JIS
  if (/BRIDA.*JIS/i.test(d)) return 'BRIDA JIS';

  // Brida Porta Placa
  if (/BRIDA.*PORTA\s*PLACA/i.test(d)) return 'PORTA PLACA';

  // Brida W.N.R.F.
  if (/BRIDA.*W\.?N\.?R\.?F/i.test(d)) return 'W.N.R.F.';

  // Brida de reduccion SORF
  if (/BRIDA.*REDUCCION.*SORF/i.test(d)) return 'SORF';

  // Reducción Excéntrica
  if (/REDUCCI[OÓ]N\s*EXC[EÉ]NTRICA/i.test(d)) return 'EXC. RED.';

  // Reducción Concéntrica
  if (/REDUCCI[OÓ]N\s*CONC[EÉ]NTRICA/i.test(d)) return 'CON. RED.';

  // Tee de Reducción
  if (/TEE?\s*(DE\s*)?REDUCCI[OÓ]N/i.test(d)) return 'RED. TEE';

  // Tee Liviana / Tee STD
  if (/TEE?\s*(LIVIANA|STD)/i.test(d)) return 'TEE';

  // Tee (other)
  if (/^TE\s/i.test(d) || /^TEE?\s/i.test(d)) return 'TEE';

  // Bulon c/tuerca
  if (/BUL[OÓ]N\s*C\/TUERCA/i.test(d)) return 'BULON';

  // Nipple BSPT
  if (/NIPPLE.*BSPT/i.test(d)) return 'NIPPLE BSPT';

  // Nipple NPT
  if (/NIPPLE.*NPT/i.test(d)) return 'NIPPLE NPT';

  // Tapa (cap) forjada
  if (/TAPA\s*S-?\d+/i.test(d)) return 'CAP';

  // Varilla
  if (/VARILLA/i.test(d)) return 'VARILLA';

  // Lote
  if (/LOTE\s*DE/i.test(d)) return 'LOTE';

  // Kilos de material
  if (/KILOS?\s*DE\s*MATERIAL/i.test(d)) return 'REZAGO';

  return '???';
}

function deriveSeries(desc: string): number | null {
  const validSeries = [150, 300, 600, 900, 1500, 2500, 2000, 3000, 6000];
  const matches = desc.toUpperCase().matchAll(/S[-.]?(\d+)/gi);
  for (const m of matches) {
    const s = parseInt(m[1], 10);
    if (validSeries.includes(s)) return s;
  }
  // DIN BAR series
  const dinMatch = desc.match(/DIN\s*(\d+)\s*BAR/i);
  if (dinMatch) return parseInt(dinMatch[1], 10);
  // JIS K series
  const jisMatch = desc.match(/JIS\s*(\d+)K/i);
  if (jisMatch) return parseInt(jisMatch[1], 10);
  return null;
}

function deriveThickness(desc: string): string | null {
  const d = desc.toUpperCase();
  if (/E\.?P\.?|EXTRA\s*PESADO|PESADO/i.test(d)) return 'XS';
  if (/SCH\.?\s*160/i.test(d)) return 'S160';
  if (/SCH\.?\s*80/i.test(d)) return 'XS';
  if (/SCH\.?\s*40/i.test(d)) return 'STD';
  if (/STD\.?|STANDARD|LIVIAN/i.test(d)) return 'STD';
  return null;
}

async function main() {
  const lines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    lines.push(msg);
  };

  log('='.repeat(80));
  log('ARTICLE METADATA INVESTIGATION REPORT');
  log('='.repeat(80));
  log('');

  // --- Stats ---
  const total = await prisma.articles.count({ where: { is_active: true, deleted_at: null } });
  const noType = await prisma.articles.count({
    where: { is_active: true, deleted_at: null, type: null },
  });
  const noSeries = await prisma.articles.count({
    where: { is_active: true, deleted_at: null, series: null },
  });
  const noThickness = await prisma.articles.count({
    where: { is_active: true, deleted_at: null, OR: [{ thickness: null }, { thickness: '' }] },
  });
  const noSize = await prisma.articles.count({
    where: { is_active: true, deleted_at: null, size: null },
  });

  log(`Total active articles: ${total}`);
  log(`Missing type: ${noType}`);
  log(`Missing series: ${noSeries}`);
  log(`Missing thickness: ${noThickness}`);
  log(`Missing size: ${noSize}`);
  log('');

  // =============================================
  // SECTION 1: Articles with NULL type
  // =============================================
  log('='.repeat(80));
  log('SECTION 1: ARTICLES WITH NULL TYPE');
  log('='.repeat(80));
  log('');

  const nullTypeArticles = await prisma.articles.findMany({
    where: { is_active: true, deleted_at: null, type: null },
    select: {
      id: true,
      code: true,
      description: true,
      type: true,
      series: true,
      thickness: true,
      size: true,
    },
    orderBy: { description: 'asc' },
  });

  const proposals: Proposal[] = nullTypeArticles.map((a) => ({
    article: { ...a, series: a.series ? Number(a.series) : null },
    proposedType: deriveType(a.description),
    proposedSeries: deriveSeries(a.description),
    proposedThickness: deriveThickness(a.description),
  }));

  // Group by proposed type
  const grouped = new Map<string, Proposal[]>();
  for (const p of proposals) {
    const key = p.proposedType;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  // Sort groups: ??? last
  const sortedKeys = [...grouped.keys()].sort((a, b) => {
    if (a === '???') return 1;
    if (b === '???') return -1;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    const items = grouped.get(key)!;
    log(`--- ${key} (${items.length} articles) ---`);
    for (const p of items) {
      const a = p.article;
      const changes: string[] = [];
      changes.push(`type=${p.proposedType}`);
      if (p.proposedSeries !== null && a.series === null)
        changes.push(`series=${p.proposedSeries}`);
      if (p.proposedThickness !== null && !a.thickness)
        changes.push(`thickness=${p.proposedThickness}`);
      log(
        `  id:${Number(a.id).toString().padStart(5)} | ${a.code.padEnd(18)} | ${a.description.substring(0, 50).padEnd(50)} | → ${changes.join(', ')}`
      );
    }
    log('');
  }

  // =============================================
  // SECTION 2: Articles with suspicious NULL series
  // =============================================
  log('='.repeat(80));
  log('SECTION 2: ARTICLES WITH SUSPICIOUS NULL SERIES');
  log('(Types where some articles have series and others do not)');
  log('='.repeat(80));
  log('');

  // Get all types that have at least one article WITH series
  const allArticles = await prisma.articles.findMany({
    where: { is_active: true, deleted_at: null, type: { not: null } },
    select: {
      id: true,
      code: true,
      description: true,
      type: true,
      series: true,
      thickness: true,
      size: true,
    },
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
  });

  const typeHasSeries = new Map<string, Set<number>>();
  const typeNullSeries = new Map<string, typeof allArticles>();

  for (const a of allArticles) {
    const t = a.type!;
    if (a.series !== null) {
      if (!typeHasSeries.has(t)) typeHasSeries.set(t, new Set());
      typeHasSeries.get(t)!.add(Number(a.series));
    } else {
      if (!typeNullSeries.has(t)) typeNullSeries.set(t, []);
      typeNullSeries.get(t)!.push(a);
    }
  }

  // Find types that have BOTH series and null-series articles
  let suspiciousCount = 0;
  for (const [type, seriesSet] of typeHasSeries.entries()) {
    const nullOnes = typeNullSeries.get(type);
    if (!nullOnes || nullOnes.length === 0) continue;

    log(`--- ${type} ---`);
    log(`  Has series: ${[...seriesSet].sort((a, b) => a - b).join(', ')}`);
    log(`  Articles MISSING series (${nullOnes.length}):`);
    for (const a of nullOnes) {
      const proposed = deriveSeries(a.description);
      log(
        `    id:${Number(a.id).toString().padStart(5)} | ${a.code.padEnd(18)} | ${a.description.substring(0, 50).padEnd(50)} | proposed: ${proposed ?? 'none'}`
      );
      suspiciousCount++;
    }
    log('');
  }

  log(`Total suspicious NULL-series articles: ${suspiciousCount}`);
  log('');
  log('='.repeat(80));
  log('END OF REPORT');
  log('='.repeat(80));

  // Save report
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'article-metadata-report.txt'), lines.join('\n'), 'utf-8');
  console.log(`\nReport saved to: scripts/output/article-metadata-report.txt`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
