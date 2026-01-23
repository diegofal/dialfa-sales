/**
 * Dashboard API Client Hooks
 * React Query hooks for fetching dashboard data
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';

/**
 * Dashboard Metrics Response
 */
export interface DashboardMetrics {
  totalOutstanding: number;
  totalOverdue: number;
  billedMonthly: number;
  billedToday: number;
  collectedMonthly: {
    total: number;
    cash: number;
    electronic: number;
    transactionCount: number;
    cashCount: number;
    electronicCount: number;
  };
}

/**
 * Top Customer
 */
export interface TopCustomer {
  Name: string;
  OutstandingBalance: number;
  OverdueAmount: number;
  OverduePercentage: number;
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
  cashFlow: CashFlowData[];
}

/**
 * Fetch dashboard metrics
 */
async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await axios.get('/api/dashboard/metrics');
  return response.data.data;
}

/**
 * Fetch dashboard charts
 */
async function fetchDashboardCharts(months: number = 12): Promise<DashboardCharts> {
  const response = await axios.get(`/api/dashboard/charts?months=${months}`);
  return response.data.data;
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
