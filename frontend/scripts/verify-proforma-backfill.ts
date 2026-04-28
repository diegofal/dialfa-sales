import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const codes = ['C24', 'BSS1501', 'TR5X3', 'CRL906', 'BCS60012'];
  const articles = await prisma.articles.findMany({
    where: { code: { in: codes } },
    select: {
      code: true,
      last_purchase_price: true,
      last_purchase_proforma_number: true,
      last_purchase_proforma_date: true,
    },
  });
  for (const a of articles) {
    console.log(
      `${a.code.padEnd(12)} price=$${a.last_purchase_price?.toString() ?? 'null'}  proforma=${a.last_purchase_proforma_number ?? 'null'}  date=${a.last_purchase_proforma_date?.toISOString().slice(0, 10) ?? 'null'}`
    );
  }
  // Idempotency check: how many still need updates?
  const total = await prisma.articles.count({
    where: { last_purchase_proforma_number: { not: null }, deleted_at: null },
  });
  console.log(`\nTotal articles with proforma tracked: ${total}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
