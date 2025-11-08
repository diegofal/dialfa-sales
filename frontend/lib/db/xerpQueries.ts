/**
 * xERP Database Queries
 * SQL Server queries for BI dashboard metrics
 * Based on dialfa-analytics queries
 */

/**
 * Get total outstanding amount (Accounts Receivable)
 * ARS currency (includes 21% IVA)
 */
export const XERP_TOTAL_OUTSTANDING = `
  SELECT 
    SUM(dt.ov_amount * 1.21) as TotalOutstanding
  FROM [0_debtor_trans] dt
  INNER JOIN [0_debtors_master] dm ON dt.debtor_no = dm.debtor_no
  WHERE dt.Type = 10 
  AND dt.ov_amount > 0
  AND dt.alloc < dt.ov_amount  -- Not fully paid
`;

/**
 * Get total overdue amount
 * ARS currency (includes 21% IVA)
 */
export const XERP_TOTAL_OVERDUE = `
  SELECT 
    SUM(CASE WHEN dt.due_date < DATEADD(HOUR, -3, GETDATE()) 
        THEN dt.ov_amount * 1.21 
        ELSE 0 END) as TotalOverdue
  FROM [0_debtor_trans] dt
  INNER JOIN [0_debtors_master] dm ON dt.debtor_no = dm.debtor_no
  WHERE dt.Type = 10 
  AND dt.ov_amount > 0
  AND dt.alloc < dt.ov_amount
`;

/**
 * Get billed amount for current month
 * ARS currency (includes 21% IVA)
 */
export const XERP_BILLED_MONTHLY = `
  SELECT 
    COALESCE(SUM(dt.ov_amount * 1.21), 0) as BilledMonthly
  FROM [0_debtor_trans] dt
  INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
  WHERE dt.Type = 10
  AND MONTH(so.ord_date) = MONTH(DATEADD(HOUR, -3, GETDATE()))
  AND YEAR(so.ord_date) = YEAR(DATEADD(HOUR, -3, GETDATE()))
  AND so.ord_date > '2020-01-01'
`;

/**
 * Get billed amount for today
 * ARS currency (includes 21% IVA)
 */
export const XERP_BILLED_TODAY = `
  SELECT 
    COALESCE(SUM(dt.ov_amount * 1.21), 0) as BilledToday
  FROM [0_debtor_trans] dt
  INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
  WHERE dt.Type = 10
  AND CAST(so.ord_date AS DATE) = CAST(DATEADD(HOUR, -3, GETDATE()) AS DATE)
`;

/**
 * Get top customers by outstanding balance
 */
export const XERP_TOP_CUSTOMERS = `
  SELECT TOP 10
    dm.name as Name,
    SUM(dt.ov_amount * 1.21) as OutstandingBalance,
    SUM(CASE WHEN dt.due_date < DATEADD(HOUR, -3, GETDATE()) 
        THEN dt.ov_amount * 1.21 
        ELSE 0 END) as OverdueAmount,
    (SUM(CASE WHEN dt.due_date < DATEADD(HOUR, -3, GETDATE()) 
        THEN dt.ov_amount * 1.21 
        ELSE 0 END) / 
     NULLIF(SUM(dt.ov_amount * 1.21), 0)) * 100 as OverduePercentage
  FROM [0_debtor_trans] dt
  INNER JOIN [0_debtors_master] dm ON dt.debtor_no = dm.debtor_no
  WHERE dt.Type = 10 
  AND dt.ov_amount > 0
  AND dt.alloc < dt.ov_amount
  GROUP BY dm.debtor_no, dm.name
  HAVING SUM(dt.ov_amount * 1.21) > 100
  ORDER BY OutstandingBalance DESC
`;

/**
 * Get monthly sales trend (last 12 months)
 */
export const XERP_MONTHLY_SALES_TREND = `
  SELECT 
    YEAR(so.ord_date) as Year,
    MONTH(so.ord_date) as Month,
    DATENAME(MONTH, so.ord_date) as MonthName,
    SUM(dt.ov_amount * 1.21) as MonthlyRevenue,
    COUNT(DISTINCT dt.trans_no) as InvoiceCount,
    COUNT(DISTINCT dt.debtor_no) as UniqueCustomers
  FROM [0_debtor_trans] dt
  INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
  WHERE dt.Type = 10
  AND so.ord_date >= DATEADD(MONTH, -12, DATEADD(HOUR, -3, GETDATE()))
  AND so.ord_date <= DATEADD(HOUR, -3, GETDATE())
  AND so.ord_date > '2020-01-01'
  GROUP BY YEAR(so.ord_date), MONTH(so.ord_date), DATENAME(MONTH, so.ord_date)
  ORDER BY Year DESC, Month DESC
`;

/**
 * Get cash flow history (monthly payments)
 * Note: This is from SPISA database
 */
export const SPISA_CASH_FLOW_HISTORY = `
  SELECT 
    YEAR(PaymentDate) as Year,
    MONTH(PaymentDate) as Month,
    SUM(PaymentAmount) as ActualPayments,
    SUM(CASE WHEN Type = 1 THEN PaymentAmount ELSE 0 END) as CashPayments,
    SUM(CASE WHEN Type = 0 THEN PaymentAmount ELSE 0 END) as ElectronicPayments,
    COUNT(*) as TransactionCount
  FROM Transactions 
  WHERE PaymentDate >= DATEADD(MONTH, -12, DATEADD(HOUR, -3, GETDATE()))
  AND PaymentDate <= DATEADD(HOUR, -3, GETDATE())
  AND PaymentDate != '0001-01-01 00:00:00'
  AND PaymentDate > '2020-01-01'
  AND PaymentAmount > 0
  GROUP BY YEAR(PaymentDate), MONTH(PaymentDate)
  ORDER BY Year, Month
`;

/**
 * Executive summary - all key metrics in one query
 */
export const XERP_EXECUTIVE_SUMMARY = `
  SELECT 
    COUNT(DISTINCT dm.debtor_no) as UniqueCustomers,
    SUM(dt.ov_amount * 1.21) as TotalOutstanding,
    SUM(CASE WHEN dt.due_date < DATEADD(HOUR, -3, GETDATE()) 
        THEN dt.ov_amount * 1.21 
        ELSE 0 END) as TotalOverdue,
    AVG(dt.ov_amount * 1.21) as AvgBalance
  FROM [0_debtor_trans] dt
  INNER JOIN [0_debtors_master] dm ON dt.debtor_no = dm.debtor_no
  WHERE dt.Type = 10 
  AND dt.ov_amount > 0
  AND dt.alloc < dt.ov_amount
`;

export interface DashboardMetrics {
  totalOutstanding: number;
  totalOverdue: number;
  billedMonthly: number;
  billedToday: number;
}

export interface TopCustomer {
  Name: string;
  OutstandingBalance: number;
  OverdueAmount: number;
  OverduePercentage: number;
}

export interface MonthlySalesTrend {
  Year: number;
  Month: number;
  MonthName: string;
  MonthlyRevenue: number;
  InvoiceCount: number;
  UniqueCustomers: number;
}

export interface CashFlowData {
  Year: number;
  Month: number;
  ActualPayments: number;
  CashPayments: number;
  ElectronicPayments: number;
  TransactionCount: number;
}

