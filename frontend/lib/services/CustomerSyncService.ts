import { prisma } from '@/lib/db';
import * as GoogleDriveService from '@/lib/services/GoogleDriveService';
import { parseWorkbook } from '@/lib/services/SyncExcelParser';
import { SyncRunResult } from '@/types/sync';

const PAST_DUE_DAYS = 30;

/**
 * Run the full customer/transaction sync from Google Drive Excel files.
 * Ports SyncPocService: FilesProcessor.Process() + Customer.RefreshBalance() + RunService.Run()
 */
export async function runSync(): Promise<SyncRunResult> {
  const startTime = new Date();
  let hasError = false;
  let customersProcessed = 0;
  let transactionsProcessed = 0;
  let errorsCount = 0;

  try {
    // 1. Truncate all sync data (matches FilesProcessor.Process() lines 32-35)
    await prisma.$executeRaw`TRUNCATE TABLE sync_transactions, sync_balances, sync_errors CASCADE`;
    await prisma.$executeRaw`DELETE FROM sync_customers`;

    // 2. Download files from Google Drive
    let files;
    try {
      files = await GoogleDriveService.listAndDownloadFiles();
    } catch (driveError) {
      const errMsg = driveError instanceof Error ? driveError.message : String(driveError);
      const errDetail =
        (driveError as { code?: number; errors?: { message: string }[] })?.errors?.[0]?.message ||
        '';
      throw new Error(`Google Drive error: ${errMsg} | ${errDetail}`);
    }

    // 3. Process each file
    for (const { fileName, buffer } of files) {
      try {
        const parsedCustomers = parseWorkbook(buffer);

        for (const parsed of parsedCustomers) {
          if (!parsed.name || parsed.transactions.length === 0) continue;

          try {
            // Find or create customer (by name + type to keep blanco/negro separate)
            let customer = await prisma.sync_customers.findFirst({
              where: { name: parsed.name, type: parsed.type },
            });

            if (!customer) {
              customer = await prisma.sync_customers.create({
                data: { name: parsed.name, type: parsed.type },
              });
            }

            // Bulk insert transactions
            if (parsed.transactions.length > 0) {
              await prisma.sync_transactions.createMany({
                data: parsed.transactions.map((t) => ({
                  row_num: t.row_num,
                  invoice_number: t.invoice_number,
                  invoice_date: t.invoice_date,
                  invoice_amount: t.invoice_amount,
                  balance: t.balance,
                  payment_receipt: t.payment_receipt,
                  payment_bank: t.payment_bank,
                  payment_date: t.payment_date,
                  payment_amount: t.payment_amount,
                  type: t.type,
                  customer_id: customer.id,
                })),
              });

              transactionsProcessed += parsed.transactions.length;
            }

            // Verify transactions and calculate balance
            await refreshBalance(customer.id, customer.name);
            customersProcessed++;
          } catch (error) {
            errorsCount++;
            await createSyncError({
              action: 'ProcessCustomer',
              fileName: parsed.name,
              message: error instanceof Error ? error.message : String(error),
              stackTrace: error instanceof Error ? error.stack : undefined,
            });
          }
        }
      } catch (error) {
        hasError = true;
        errorsCount++;
        await createSyncError({
          action: 'ProcessImport',
          fileName,
          message: error instanceof Error ? error.message : String(error),
          stackTrace: error instanceof Error ? error.stack : undefined,
        });
      }
    }
  } catch (error) {
    hasError = true;
    errorsCount++;
    await createSyncError({
      action: 'RunSync',
      fileName: 'N/A',
      message: error instanceof Error ? error.message : String(error),
      stackTrace: error instanceof Error ? error.stack : undefined,
    });
  }

  // Record the run
  const endTime = new Date();
  const run = await prisma.sync_runs.create({
    data: {
      start_date: startTime,
      end_date: endTime,
      duration_ms: endTime.getTime() - startTime.getTime(),
      has_error: hasError,
    },
  });

  return {
    id: run.id,
    startDate: run.start_date.toISOString(),
    endDate: run.end_date.toISOString(),
    durationMs: run.duration_ms,
    hasError: run.has_error,
    customersProcessed,
    transactionsProcessed,
    errorsCount,
  };
}

/**
 * Verify transactions and calculate balance for a customer.
 * Ports Customer.RefreshBalance(), VerifyTransactions(), CalculatePastDueBalance()
 */
async function refreshBalance(customerId: string, customerName: string): Promise<void> {
  const transactions = await prisma.sync_transactions.findMany({
    where: { customer_id: customerId },
    orderBy: { row_num: 'asc' },
  });

  if (transactions.length === 0) return;

  // VerifyTransactions: SUM(invoice_amount) - SUM(payment_amount) should == lastRow.balance
  const totalDebt = transactions.reduce((sum, t) => sum + (t.invoice_amount ?? 0), 0);
  const totalPayments = transactions.reduce((sum, t) => sum + (t.payment_amount ?? 0), 0);
  const lastTransaction = transactions[transactions.length - 1];
  const latestBalance = lastTransaction.balance;

  if (Math.round(totalDebt - totalPayments) !== Math.round(latestBalance)) {
    await createSyncError({
      action: 'VerifyTransactions',
      fileName: customerName,
      message: `Total debt - total payments (${totalDebt - totalPayments}) != balance (${latestBalance})`,
      customerId,
    });
  }

  // CalculatePastDueBalance: balance - SUM(invoices in last 30 days where invoice_amount > 0)
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - PAST_DUE_DAYS);

  const recentInvoicesTotal = transactions
    .filter((t) => t.invoice_date && t.invoice_date > limitDate && (t.invoice_amount ?? 0) > 0)
    .reduce((sum, t) => sum + (t.invoice_amount ?? 0), 0);

  const pastDueBalance = latestBalance - recentInvoicesTotal;
  const due = pastDueBalance > 0 ? pastDueBalance : 0;

  // Store balance
  await prisma.sync_balances.create({
    data: {
      amount: latestBalance,
      due,
      date: new Date(),
      customer_id: customerId,
    },
  });
}

async function createSyncError(params: {
  action: string;
  fileName: string;
  message: string;
  stackTrace?: string;
  customerId?: string;
}): Promise<void> {
  await prisma.sync_errors.create({
    data: {
      action: params.action,
      file_name: params.fileName,
      message: params.message,
      date: new Date(),
      stack_trace: params.stackTrace ?? null,
      customer_id: params.customerId ?? null,
    },
  });
}
