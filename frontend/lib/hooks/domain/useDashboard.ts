/**
 * Dashboard API Client Hooks
 * React Query hooks for fetching dashboard data
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';

/**
 * Dashboard data source error envelope.
 * Each field is null on success, or contains the error message when the
 * underlying source failed (xerp = legacy SQL Server, spisa = Postgres).
 */
export interface DashboardSourceErrors {
  xerp: string | null;
  spisa: string | null;
}

/**
 * Dashboard Metrics Response (commercial pulse).
 * xERP-backed fields are null when xERP is unreachable; check `errors.xerp`.
 * SPISA-backed margin fields are null when there's no data OR when SPISA failed.
 */
export interface DashboardMetrics {
  totalOutstanding: number | null;
  totalOverdue: number | null;
  billedMonthly: number | null;
  billedToday: number | null;
  billedPrevMonth: number | null;
  billedSameMonthPrevYear: number | null;
  dailyAverageThisMonth: number | null;
  daysElapsedThisMonth: number;
  grossMarginPercent: number | null;
  grossMarginAmountArs: number | null;
  grossMarginPrevPercent: number | null;
  errors: DashboardSourceErrors;
}

/**
 * Operational Metrics Response (stock + backlog)
 */
export interface OperationalMetrics {
  stockValueCostUsd: number;
  stockValueCostArs: number;
  stockValueRetailArs: number;
  deadStockValueArs: number;
  deadStockArticleCount: number;
  stockoutsCriticalCount: number;
  pendingToInvoiceCount: number;
  pendingToInvoiceArs: number;
  usdExchangeRate: number;
}

/**
 * Top Customer (by AR balance, from xERP)
 */
export interface TopCustomer {
  Name: string;
  OutstandingBalance: number;
  OverdueAmount: number;
  OverduePercentage: number;
}

/**
 * Top Customer by current-month revenue (from SPISA invoices)
 */
export interface TopCustomerByRevenue {
  clientId: number;
  businessName: string;
  revenueArs: number;
  invoiceCount: number;
}

/**
 * Monthly Sales Trend
 */
export interface MonthlySalesTrend {
  Year: number;
  Month: number;
  MonthName: string;
  MonthlyRevenue: number;
  InvoiceCount: number;
  UniqueCustomers: number;
}

/**
 * Cash Flow Data
 */
export interface CashFlowData {
  Year: number;
  Month: number;
  ActualPayments: number;
  CashPayments: number;
  ElectronicPayments: number;
  TransactionCount: number;
}

/**
 * Dashboard Charts Response
 */
export interface DashboardCharts {
  topCustomers: TopCustomer[];
  salesTrend: MonthlySalesTrend[];
  topCustomersByRevenue: TopCustomerByRevenue[];
  errors: DashboardSourceErrors;
}

/**
 * Dashboard Alerts Response
 */
export interface DashboardAlerts {
  stockoutsCount: number;
  lateProformasCount: number;
  pendingQuotesCount: number;
}

/**
 * Fetch dashboard metrics
 */
async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await axios.get('/api/dashboard/metrics');
  return response.data;
}

/**
 * Fetch dashboard charts
 */
async function fetchDashboardCharts(months: number = 12): Promise<DashboardCharts> {
  const response = await axios.get(`/api/dashboard/charts?months=${months}`);
  return response.data;
}

async function fetchOperationalMetrics(): Promise<OperationalMetrics> {
  const response = await axios.get('/api/dashboard/operational');
  return response.data;
}

async function fetchDashboardAlerts(): Promise<DashboardAlerts> {
  const response = await axios.get('/api/dashboard/alerts');
  return response.data;
}

/**
 * Hook to fetch dashboard metrics
 */
export function useDashboardMetrics(): UseQueryResult<DashboardMetrics, Error> {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: fetchDashboardMetrics,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 minutes
  });
}

/**
 * Hook to fetch dashboard charts
 */
export function useDashboardCharts(months: number = 12): UseQueryResult<DashboardCharts, Error> {
  return useQuery({
    queryKey: ['dashboard', 'charts', months],
    queryFn: () => fetchDashboardCharts(months),
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
}

export function useOperationalMetrics(): UseQueryResult<OperationalMetrics, Error> {
  return useQuery({
    queryKey: ['dashboard', 'operational'],
    queryFn: fetchOperationalMetrics,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });
}

export function useDashboardAlerts(): UseQueryResult<DashboardAlerts, Error> {
  return useQuery({
    queryKey: ['dashboard', 'alerts'],
    queryFn: fetchDashboardAlerts,
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });
}

/**
 * Currency formatter for ARS
 */
export function formatCurrency(value: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Number formatter (with K, M suffixes)
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

/**
 * Compute % delta between current and previous values.
 * Returns null when either input is null/0 (delta undefined).
 */
export function computeDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
