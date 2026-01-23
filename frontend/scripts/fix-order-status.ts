/**
 * Script to fix inconsistent sales order statuses
 *
 * This script updates sales orders that have active invoices but are still marked as PENDING.
 * It should be run once to fix existing data inconsistencies.
 *
 * Run with: npx tsx scripts/fix-order-status.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOrderStatuses() {
  console.log('Starting sales order status fix...\n');

  try {
    const BATCH_SIZE = 100;
    let fixedCount = 0;
    let skip = 0;
    let hasMore = true;

    // Process PENDING orders in batches
    console.log('Checking PENDING orders...');
    while (hasMore) {
      const pendingOrders = await prisma.sales_orders.findMany({
        where: {
          status: 'PENDING',
          deleted_at: null,
        },
        include: {
          invoices: {
            where: {
              deleted_at: null,
              is_cancelled: false,
            },
          },
        },
        take: BATCH_SIZE,
        skip,
      });

      if (pendingOrders.length === 0) {
        hasMore = false;
        break;
      }

      for (const order of pendingOrders) {
        // If order has active invoices, it should be INVOICED not PENDING
        if (order.invoices.length > 0) {
          console.log(
            `Order ${order.order_number} has ${order.invoices.length} active invoice(s) but is marked as PENDING`
          );

          await prisma.sales_orders.update({
            where: { id: order.id },
            data: {
              status: 'INVOICED',
              updated_at: new Date(),
            },
          });

          fixedCount++;
          console.log(`  ✓ Updated to INVOICED`);
        }
      }

      skip += BATCH_SIZE;
      console.log(`Processed ${skip} PENDING orders...`);
    }

    // Reset for INVOICED orders
    skip = 0;
    hasMore = true;

    // Process INVOICED orders in batches
    console.log('\nChecking INVOICED orders...');
    while (hasMore) {
      const invoicedOrders = await prisma.sales_orders.findMany({
        where: {
          status: 'INVOICED',
          deleted_at: null,
        },
        include: {
          invoices: {
            where: {
              deleted_at: null,
              is_cancelled: false,
            },
          },
        },
        take: BATCH_SIZE,
        skip,
      });

      if (invoicedOrders.length === 0) {
        hasMore = false;
        break;
      }

      for (const order of invoicedOrders) {
        // If order has NO active invoices, it should be PENDING not INVOICED
        if (order.invoices.length === 0) {
          console.log(
            `Order ${order.order_number} has NO active invoices but is marked as INVOICED`
          );

          await prisma.sales_orders.update({
            where: { id: order.id },
            data: {
              status: 'PENDING',
              updated_at: new Date(),
            },
          });

          fixedCount++;
          console.log(`  ✓ Updated to PENDING`);
        }
      }

      skip += BATCH_SIZE;
      console.log(`Processed ${skip} INVOICED orders...`);
    }

    console.log(`\n✓ Fixed ${fixedCount} order(s) with inconsistent status`);
  } catch (error) {
    console.error('Error fixing order statuses:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixOrderStatuses()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFailed:', error);
    process.exit(1);
  });
