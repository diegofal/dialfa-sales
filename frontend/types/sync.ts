export interface SyncRunResult {
  id: string;
  startDate: string;
  endDate: string;
  durationMs: number;
  hasError: boolean;
  customersProcessed: number;
  transactionsProcessed: number;
  errorsCount: number;
}

export interface ParsedTransaction {
  row_num: number;
  invoice_number: string | null;
  invoice_date: Date | null;
  invoice_amount: number | null;
  balance: number;
  payment_receipt: string | null;
  payment_bank: string | null;
  payment_date: Date | null;
  payment_amount: number | null;
  type: number;
}

export interface ParsedCustomer {
  name: string;
  type: number;
  transactions: ParsedTransaction[];
}
