/**
 * xERP Database Queries (SQL Server)
 *
 * Canonical NET billed amounts: invoices (Type=10) minus credit notes (Type=11),
 * each multiplied by 1.21 (IVA). This mirrors what the dialfa-bi dashboard uses
 * (see dialfa-bi/database/queries.py:961-989). Using gross-only amounts (Type=10
 * without subtracting Type=11) overstates monthly billing.
 *
 * Outstanding/overdue and top-customers metrics no longer hit xERP — they read
 * from SPISA's sync_* tables (Postgres) instead, which is also what BI uses.
 */

/**
 * NET billed amount for current calendar month (ARS, includes IVA).
 */
export const XERP_BILLED_MONTHLY_NET = `
  WITH FC AS (
    SELECT COALESCE(SUM(Total) * 1.21, 0) AS amt
    FROM [0_debtor_trans] dt
    INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
    WHERE dt.Type = 10
      AND MONTH(ord_date) = MONTH(DATEADD(HOUR, -3, GETDATE()))
      AND YEAR(ord_date) = YEAR(DATEADD(HOUR, -3, GETDATE()))
      AND ord_date > '2020-01-01'
  ),
  NC AS (
    SELECT COALESCE(SUM(Total) * 1.21, 0) AS amt
    FROM [0_debtor_trans] dt
    INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
    WHERE dt.Type = 11
      AND MONTH(ord_date) = MONTH(DATEADD(HOUR, -3, GETDATE()))
      AND YEAR(ord_date) = YEAR(DATEADD(HOUR, -3, GETDATE()))
      AND ord_date > '2020-01-01'
  )
  SELECT (FC.amt - NC.amt) AS BilledNet FROM FC, NC
`;

/**
 * NET billed amount for today (ARS, includes IVA).
 */
export const XERP_BILLED_TODAY_NET = `
  WITH FC AS (
    SELECT COALESCE(SUM(Total) * 1.21, 0) AS amt
    FROM [0_debtor_trans] dt
    INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
    WHERE dt.Type = 10
      AND CAST(ord_date AS DATE) = CAST(DATEADD(HOUR, -3, GETDATE()) AS DATE)
  ),
  NC AS (
    SELECT COALESCE(SUM(Total) * 1.21, 0) AS amt
    FROM [0_debtor_trans] dt
    INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
    WHERE dt.Type = 11
      AND CAST(ord_date AS DATE) = CAST(DATEADD(HOUR, -3, GETDATE()) AS DATE)
  )
  SELECT (FC.amt - NC.amt) AS BilledNet FROM FC, NC
`;

/**
 * NET billed amount for previous calendar month (ARS).
 */
export const XERP_BILLED_PREV_MONTH_NET = `
  WITH FC AS (
    SELECT COALESCE(SUM(Total) * 1.21, 0) AS amt
    FROM [0_debtor_trans] dt
    INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
    WHERE dt.Type = 10
      AND MONTH(ord_date) = MONTH(DATEADD(MONTH, -1, DATEADD(HOUR, -3, GETDATE())))
      AND YEAR(ord_date) = YEAR(DATEADD(MONTH, -1, DATEADD(HOUR, -3, GETDATE())))
      AND ord_date > '2020-01-01'
  ),
  NC AS (
    SELECT COALESCE(SUM(Total) * 1.21, 0) AS amt
    FROM [0_debtor_trans] dt
    INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
    WHERE dt.Type = 11
      AND MONTH(ord_date) = MONTH(DATEADD(MONTH, -1, DATEADD(HOUR, -3, GETDATE())))
      AND YEAR(ord_date) = YEAR(DATEADD(MONTH, -1, DATEADD(HOUR, -3, GETDATE())))
      AND ord_date > '2020-01-01'
  )
  SELECT (FC.amt - NC.amt) AS BilledNet FROM FC, NC
`;

/**
 * NET billed amount for the same calendar month, previous year (ARS).
 */
export const XERP_BILLED_SAME_MONTH_PREV_YEAR_NET = `
  WITH FC AS (
    SELECT COALESCE(SUM(Total) * 1.21, 0) AS amt
    FROM [0_debtor_trans] dt
    INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
    WHERE dt.Type = 10
      AND MONTH(ord_date) = MONTH(DATEADD(HOUR, -3, GETDATE()))
      AND YEAR(ord_date) = YEAR(DATEADD(HOUR, -3, GETDATE())) - 1
      AND ord_date > '2020-01-01'
  ),
  NC AS (
    SELECT COALESCE(SUM(Total) * 1.21, 0) AS amt
    FROM [0_debtor_trans] dt
    INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
    WHERE dt.Type = 11
      AND MONTH(ord_date) = MONTH(DATEADD(HOUR, -3, GETDATE()))
      AND YEAR(ord_date) = YEAR(DATEADD(HOUR, -3, GETDATE())) - 1
      AND ord_date > '2020-01-01'
  )
  SELECT (FC.amt - NC.amt) AS BilledNet FROM FC, NC
`;

/**
 * NET monthly sales trend for the last 12 months (ARS, includes IVA).
 * Mirrors dialfa-bi/database/queries.py:924-958.
 */
export const XERP_MONTHLY_SALES_TREND_NET = `
  SELECT
    YEAR(so.ord_date) as Year,
    MONTH(so.ord_date) as Month,
    DATENAME(MONTH, so.ord_date) as MonthName,
    SUM(CASE WHEN dt.Type = 10 THEN dt.Total * 1.21
             WHEN dt.Type = 11 THEN dt.Total * -1.21
             ELSE 0 END) as MonthlyRevenue,
    COUNT(DISTINCT CASE WHEN dt.Type = 10 THEN dt.trans_no END) as InvoiceCount,
    COUNT(DISTINCT so.debtor_no) as UniqueCustomers
  FROM [0_debtor_trans] dt
  INNER JOIN [0_sales_orders] so ON so.ID = dt.order_
  WHERE dt.Type IN (10, 11)
    AND so.ord_date >= DATEADD(MONTH, -12, DATEADD(HOUR, -3, GETDATE()))
    AND so.ord_date <= DATEADD(HOUR, -3, GETDATE())
    AND so.ord_date > '2020-01-01'
  GROUP BY YEAR(so.ord_date), MONTH(so.ord_date), DATENAME(MONTH, so.ord_date)
  ORDER BY Year DESC, Month DESC
`;

export interface MonthlySalesTrend {
  Year: number;
  Month: number;
  MonthName: string;
  MonthlyRevenue: number;
  InvoiceCount: number;
  UniqueCustomers: number;
}
