import { prisma } from '@/lib/db';

/**
 * Public data service for dialfa-analytics consumption.
 * Exposes sync_* tables and stock_snapshots via structured queries.
 */

export async function getBalances() {
  const balances = await prisma.sync_balances.findMany({
    include: {
      customer: {
        select: { name: true, type: true },
      },
    },
  });

  return balances.map((b) => ({
    CustomerId: b.customer_id,
    Name: b.customer.name,
    Type: b.customer.type,
    Amount: b.amount,
    Due: b.due,
    Date: b.date.toISOString(),
  }));
}

export async function getTransactions(months = 12) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const transactions = await prisma.sync_transactions.findMany({
    where: {
      OR: [{ invoice_date: { gte: since } }, { payment_date: { gte: since } }],
    },
    include: {
      customer: {
        select: { name: true, type: true },
      },
    },
    orderBy: { row_num: 'asc' },
  });

  return transactions.map((t) => ({
    Id: t.id,
    CustomerId: t.customer_id,
    CustomerName: t.customer.name,
    Type: t.type,
    RowNum: t.row_num,
    InvoiceNumber: t.invoice_number,
    InvoiceDate: t.invoice_date?.toISOString() ?? null,
    InvoiceAmount: t.invoice_amount ?? 0,
    Balance: t.balance,
    PaymentReceipt: t.payment_receipt,
    PaymentBank: t.payment_bank,
    PaymentDate: t.payment_date?.toISOString() ?? null,
    PaymentAmount: t.payment_amount ?? 0,
  }));
}

export async function getStockSnapshots(months = 12) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const snapshots = await prisma.stock_snapshots.findMany({
    where: { date: { gte: since } },
    orderBy: { date: 'asc' },
  });

  return snapshots.map((s) => ({
    Date: s.date.toISOString(),
    StockValue: Number(s.stock_value),
    Year: s.date.getFullYear(),
    Month: s.date.getMonth() + 1,
    MonthName: s.date.toLocaleString('en-US', { month: 'long' }),
  }));
}
