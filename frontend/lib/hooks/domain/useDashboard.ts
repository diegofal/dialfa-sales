/**
 * Dashboard API Client Hooks
 * React Query hooks for fetching dashboard data
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import axios from 'axios';

/**
 * Per-source error envelope. Each null on success, message on failure.
 * - xerp: legacy Azure SQL Server (billed amounts, sales trend)
 * - spisa: PostgreSQL (everything else)
 */
export interface DashboardSourceErrors {
  xerp: string | null;
  spisa: string | null;
}

export interface ToCollectMonthly {
  total: number;
  cleared: number;
  pending: number;
  transactionCount: number;
}

/**
 * Dashboard Metrics Response (commercial pulse).
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
  toCollectMonthly: ToCollectMonthly | null;
  checksInPortfolio: number | null;
  grossMarginPercent: number | null;
  grossMarginAmountArs: number | null;
  grossMarginPrevPercent: number | null;
  errors: DashboardSourceErrors;
}

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TopCustomer {
  Name: string;
  OutstandingBalance: number;
  OverdueAmount: number;
  OverduePercentage: number;
  RiskLevel: RiskLevel;
}

export interface TopCustomerByRevenue {
  clientId: number;
  businessName: string;
  revenueArs: number;
  invoiceCount: number;
}

export interface MonthlySalesTrend {
  Year: number;
  Month: number;
  MonthName: string;
  MonthlyRevenue: number;
  InvoiceCount: number;
  UniqueCustomers: number;
}

export interface DashboardCharts {
  topCustomers: TopCustomer[];
  salesTrend: MonthlySalesTrend[];
  topCustomersByRevenue: TopCustomerByRevenue[];
  errors: DashboardSourceErrors;
}

export interface OperationalMetrics {
  stockValueCost: number;
  stockValueRetail: number;
  deadStockValue: number;
  deadStockArticleCount: number;
  stockoutsCriticalCount: number;
  error: string | null;
}

// Mirror of types/stockValuation.ts for client-side narrowing.
export type DashboardStockStatus = 'active' | 'slow_moving' | 'dead_stock' | 'never_sold';

export interface TopArticleSold {
  articleId: number;
  code: string;
  description: string;
  unitsSold: number;
  revenueUsd: number;
  currentStock: number;
  status: DashboardStockStatus;
}

export interface TopArticlesSoldResponse {
  articles: TopArticleSold[];
  error: string | null;
}

export interface DashboardAlerts {
  stockoutsCount: number;
  lateProformasCount: number;
  pendingQuotesCount: number;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await axios.get('/api/dashboard/metrics');
  return response.data;
}

async function fetchDashboardCharts(): Promise<DashboardCharts> {
  const response = await axios.get('/api/dashboard/charts');
  return response.data;
}

async function fetchOperationalMetrics(): Promise<OperationalMetrics> {
  const response = await axios.get('/api/dashboard/operational');
  return response.data;
}

async function fetchTopArticlesSold(): Promise<TopArticlesSoldResponse> {
  const response = await axios.get('/api/dashboard/top-articles');
  return response.data;
}

async function fetchDashboardAlerts(): Promise<DashboardAlerts> {
  const response = await axios.get('/api/dashboard/alerts');
  return response.data;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDashboardMetrics(): UseQueryResult<DashboardMetrics, Error> {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: fetchDashboardMetrics,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useDashboardCharts(): UseQueryResult<DashboardCharts, Error> {
  return useQuery({
    queryKey: ['dashboard', 'charts'],
    queryFn: fetchDashboardCharts,
    staleTime: 1000 * 60 * 10,
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

export function useTopArticlesSold(): UseQueryResult<TopArticlesSoldResponse, Error> {
  return useQuery({
    queryKey: ['dashboard', 'top-articles'],
    queryFn: fetchTopArticlesSold,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
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

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatCurrency(value: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

/**
 * % delta between current and previous. Returns null when previous is null/0.
 */
export function computeDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
