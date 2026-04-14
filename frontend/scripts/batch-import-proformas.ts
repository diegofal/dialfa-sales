/**
 * Batch import all CSV proformas from D:\Pedidos\Proformas\csvs\
 * One-time script — creates supplier orders for each CSV.
 *
 * Usage: npx tsx scripts/batch-import-proformas.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { ArticleMatcher } from '../lib/utils/priceLists/proformaImport/article-matcher';
import { CsvExtractor } from '../lib/utils/priceLists/proformaImport/csv-extractor';
import {
  calculateWeightedAvgSales,
  calculateEstimatedSaleTime,
} from '../lib/utils/salesCalculations';

const CSV_DIR = 'D:\\Pedidos\\Proformas\\csvs';
const prisma = new PrismaClient();

interface ImportSummary {
  file: string;
  status: 'created' | 'skipped' | 'error';
  orderNumber?: string;
  totalItems?: number;
  matchedItems?: number;
  error?: string;
}

async function resolveSupplier(name: string): Promise<number | null> {
  const supplier = await prisma.suppliers.findFirst({
    where: {
      name: { contains: name, mode: 'insensitive' },
      is_active: true,
      deleted_at: null,
    },
    select: { id: true },
  });
  return supplier?.id ?? null;
}

async function getNextOrderNumber(): Promise<string> {
  const lastOrder = await prisma.supplier_orders.findFirst({
    orderBy: { id: 'desc' },
  });
  const nextNumber = lastOrder ? Number(lastOrder.id) + 1 : 1;
  return `PO-${String(nextNumber).padStart(6, '0')}`;
}

async function importCsv(filePath: string, matcher: ArticleMatcher): Promise<ImportSummary> {
  const fileName = path.basename(filePath);

  try {
    // Check if already imported (by source_file or proforma_number)
    const extractor = new CsvExtractor();
    const metadata = extractor.extractMetadataFromFilename(fileName);

    const existing = await prisma.supplier_orders.findFirst({
      where: {
        OR: [{ source_file: fileName }, { proforma_number: metadata.proformaNumber }],
        deleted_at: null,
      },
    });

    if (existing) {
      return {
        file: fileName,
        status: 'skipped',
        error: `Already exists as ${existing.order_number}`,
      };
    }

    // Parse CSV
    const buffer = fs.readFileSync(filePath);
    const proforma = await extractor.extract(buffer, fileName);

    if (proforma.items.length === 0) {
      return { file: fileName, status: 'skipped', error: 'No items found' };
    }

    // Match articles
    const matchedItems = await matcher.matchItems(proforma.items);
    const goodMatches = matchedItems.filter((m) => m.confidence >= 70 && m.article);

    if (goodMatches.length === 0) {
      return {
        file: fileName,
        status: 'skipped',
        error: `No matched items (${matchedItems.length} total)`,
      };
    }

    // Resolve supplier
    const supplierId = metadata.supplier ? await resolveSupplier(metadata.supplier) : null;

    // Build items with sales metrics
    const items = goodMatches.map((m) => {
      const avgMonthlySales = calculateWeightedAvgSales(m.article!.salesTrend || []);
      const estimatedSaleTime = calculateEstimatedSaleTime(
        m.extractedItem.quantity,
        avgMonthlySales
      );

      return {
        article_id: BigInt(m.article!.id),
        article_code: m.article!.code,
        article_description: m.article!.description,
        quantity: m.extractedItem.quantity,
        current_stock: m.article!.stock,
        minimum_stock: m.article!.minimumStock,
        avg_monthly_sales: avgMonthlySales > 0 ? avgMonthlySales : null,
        estimated_sale_time: isFinite(estimatedSaleTime) ? estimatedSaleTime : null,
        unit_weight: m.unitWeight || null,
        proforma_unit_price: m.proformaUnitPrice || null,
        proforma_total_price: m.proformaTotalPrice || null,
        db_unit_price: m.dbUnitPrice || null,
        db_total_price: m.dbTotalPrice || null,
        margin_absolute: m.marginAbsolute || null,
        margin_percent: m.marginPercent || null,
      };
    });

    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

    // Calculate weighted avg sale time
    let totalWeightedTime = 0;
    let totalQtyWithData = 0;
    for (const item of items) {
      if (item.estimated_sale_time && isFinite(item.estimated_sale_time)) {
        totalWeightedTime += item.estimated_sale_time * item.quantity;
        totalQtyWithData += item.quantity;
      }
    }
    const avgSaleTime = totalQtyWithData > 0 ? totalWeightedTime / totalQtyWithData : null;

    const orderNumber = await getNextOrderNumber();

    const order = await prisma.supplier_orders.create({
      data: {
        order_number: orderNumber,
        proforma_number: metadata.proformaNumber || null,
        order_date:
          metadata.date && !isNaN(new Date(metadata.date).getTime())
            ? new Date(metadata.date)
            : new Date(),
        cif_percentage: 50,
        supplier_id: supplierId,
        status: 'draft',
        total_items: items.length,
        total_quantity: totalQuantity,
        estimated_sale_time_months: avgSaleTime,
        source_file: fileName,
        created_by: 1,
        updated_by: 1,
        supplier_order_items: {
          create: items,
        },
      },
    });

    return {
      file: fileName,
      status: 'created',
      orderNumber: order.order_number,
      totalItems: proforma.items.length,
      matchedItems: goodMatches.length,
    };
  } catch (error) {
    return {
      file: fileName,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log(`Reading CSVs from ${CSV_DIR}...\n`);

  const files = fs
    .readdirSync(CSV_DIR)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .sort();

  console.log(`Found ${files.length} CSV files.\n`);

  const matcher = new ArticleMatcher(prisma);
  const results: ImportSummary[] = [];

  for (const file of files) {
    const filePath = path.join(CSV_DIR, file);
    process.stdout.write(`  ${file}... `);
    const result = await importCsv(filePath, matcher);
    results.push(result);

    if (result.status === 'created') {
      console.log(
        `CREATED ${result.orderNumber} (${result.matchedItems}/${result.totalItems} items)`
      );
    } else if (result.status === 'skipped') {
      console.log(`SKIPPED: ${result.error}`);
    } else {
      console.log(`ERROR: ${result.error}`);
    }
  }

  await matcher.cleanup();
  await prisma.$disconnect();

  // Summary
  const created = results.filter((r) => r.status === 'created').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const errors = results.filter((r) => r.status === 'error').length;

  console.log(`\n--- Summary ---`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors:  ${errors}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
