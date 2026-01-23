/**
 * Dashboard Metrics Section
 * Displays the 5 main BI metric cards
 */

'use client';

import { FileText, Calendar, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDashboardMetrics, formatCurrency } from '@/lib/hooks/useDashboard';
import { MetricCard } from './MetricCard';

export function DashboardMetrics() {
  const { data: metrics, isLoading, isError, error } = useDashboardMetrics();

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error al cargar las métricas: {error?.message || 'Error desconocido'}
        </AlertDescription>
      </Alert>
    );
  }

  // Get current month name
  const currentMonth = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date());
  const monthCapitalized = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Billed This Month */}
      <MetricCard
        title={`Facturado en ${monthCapitalized}`}
        value={isLoading ? '...' : formatCurrency(metrics?.billedMonthly || 0)}
        subtitle="Ventas Mensuales"
        icon={FileText}
        gradient="bg-gradient-to-br from-green-500 to-green-700"
        loading={isLoading}
      />

      {/* Billed Today */}
      <MetricCard
        title="Facturado Hoy"
        value={isLoading ? '...' : formatCurrency(metrics?.billedToday || 0)}
        subtitle="Ventas Diarias"
        icon={Calendar}
        gradient="bg-gradient-to-br from-teal-500 to-teal-700"
        loading={isLoading}
      />
    </div>
  );
}
