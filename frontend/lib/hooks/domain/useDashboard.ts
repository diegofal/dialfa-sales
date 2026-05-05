/**
 * Dashboard API Client Hooks
 * React Query hooks for fetching dashboard data
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';

/**
 * Dashboard Metrics Response (commercial pulse)
 */
export interface DashboardMetrics {
  totalOutstanding: number;
  totalOverdue: number;
  billedMonthly: number;
  billedToday: number;
  billedPrevMonth: number;
  billedSameMonthPrevYear: number;
  dailyAverageThisMonth: number;
  daysElapsedThisMonth: number;
  grossMarginPercent: number | null;
  grossMarginAmountArs: number | null;
  grossMarginPrevPercent: number | null;
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
 * Returns null when previous is 0 (delta undefined).
 */
export function computeDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
