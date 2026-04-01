'use client';

import { AlertCircle, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ValuationByCategory } from '@/components/articles/ValuationByCategory';
import { ValuationFilters } from '@/components/articles/ValuationFilters';
import { ValuationSummary } from '@/components/articles/ValuationSummary';
import { ValuationTable } from '@/components/articles/ValuationTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  useStockValuation,
  useRefreshStockValuation,
  useStockCategorySnapshots,
} from '@/lib/hooks/domain/useStockValuation';
import { useAuthStore } from '@/store/authStore';
import {
  StockClassificationConfig,
  StockStatus,
  StockValuationMetrics,
} from '@/types/stockValuation';

export default function ValuationPage() {
  const { isAdmin } = useAuthStore();

  const [config, setConfig] = useState<StockClassificationConfig>({
    activeThresholdDays: 90,
    slowMovingThresholdDays: 180,
    deadStockThresholdDays: 365,
    minSalesForActive: 5,
    trendMonths: 6,
    includeZeroStock: false,
  });

  const [selectedStatus, setSelectedStatus] = useState<StockStatus | 'all'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [trendMonths, setTrendMonths] = useState<number>(6);

  // Usar trendMonths en la configuración para que se recarguen los datos
  const valuationConfig = {
    ...config,
    trendMonths: trendMonths,
  };

  const { data: valuation, isLoading, error } = useStockValuation(valuationConfig);
  const { data: categorySnapshots } = useStockCategorySnapshots();
  const refreshMutation = useRefreshStockValuation();

  const handleRefresh = () => {
    refreshMutation.mutate(config);
  };

  const handleStatusClick = (status: StockStatus) => {
    setSelectedCategoryId(null); // Clear category filter when clicking status cards
    setSelectedStatus(selectedStatus === status ? 'all' : status);
  };

  const handleCategoryStatusClick = (categoryId: number, status: StockStatus) => {
    // Toggle: if same selection, clear it
    if (selectedCategoryId === categoryId && selectedStatus === status) {
      setSelectedCategoryId(null);
      setSelectedStatus('all');
    } else {
      setSelectedCategoryId(categoryId);
      setSelectedStatus(status);
    }
  };

  const handleCategoryTotalClick = (categoryId: number) => {
    // Toggle: if same category selected with 'all' status, clear it
    if (selectedCategoryId === categoryId && selectedStatus === 'all') {
      setSelectedCategoryId(null);
    } else {
      setSelectedCategoryId(categoryId);
      setSelectedStatus('all');
    }
  };

  // Filtrar artículos según el status y categoría seleccionados
  const filteredArticles = valuation
    ? (() => {
        let articles =
          selectedStatus === 'all'
            ? Object.values(valuation.byStatus).flatMap((group) => group.articles)
            : valuation.byStatus[selectedStatus]?.articles || [];

        // Si hay categoría seleccionada, filtrar por ella
        if (selectedCategoryId !== null) {
          articles = articles.filter((a) => a.categoryId === selectedCategoryId);
        }

        return articles;
      })()
    : [];

  // Ordenar por valor de stock descendente
  const sortedArticles = [...filteredArticles].sort((a, b) => b.stockValue - a.stockValue);

  const handleExportCSV = (articles: StockValuationMetrics[]) => {
    if (articles.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    const statusLabels: Record<StockStatus, string> = {
      [StockStatus.ACTIVE]: 'Activo',
      [StockStatus.SLOW_MOVING]: 'Mov. Lento',
      [StockStatus.DEAD_STOCK]: 'Stock Muerto',
      [StockStatus.NEVER_SOLD]: 'Nunca Vendido',
    };

    const formatDate = (date: Date | null) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('es-AR');
    };

    const headers = [
      'Código',
      'Descripción',
      'Categoría',
      'Estado',
      'Stock',
      'Última Venta',
      'Días Sin Venta',
      'Prom. Ventas/Mes',
      'Tendencia',
      'Costo Unitario',
      'Valor Costo',
      'Precio Lista',
      'Valor Lista',
      'Meses de Inventario',
    ];

    const rows = articles.map((a) => [
      a.articleCode,
      `"${a.articleDescription.replace(/"/g, '""')}"`,
      `"${a.categoryName.replace(/"/g, '""')}"`,
      statusLabels[a.status],
      a.currentStock.toFixed(2),
      formatDate(a.lastSaleDate),
      a.daysSinceLastSale !== null ? a.daysSinceLastSale.toString() : '',
      a.avgMonthlySales.toFixed(2),
      a.salesTrendDirection === 'increasing'
        ? 'Subiendo'
        : a.salesTrendDirection === 'decreasing'
          ? 'Bajando'
          : a.salesTrendDirection === 'stable'
            ? 'Estable'
            : 'Sin datos',
      a.unitCost.toFixed(2),
      a.stockValue.toFixed(2),
      a.unitPrice.toFixed(2),
      a.stockValueAtListPrice.toFixed(2),
      a.monthsOfInventory.toFixed(1),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valorizacion-stock-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`${articles.length} artículos exportados a CSV`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Valorización de Inventario</h1>
        <p className="text-muted-foreground mt-1">
          Análisis de stock por movimiento y valorización
        </p>
      </div>

      {/* Filters */}
      <ValuationFilters
        config={config}
        onConfigChange={setConfig}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        onRefresh={isAdmin() ? handleRefresh : undefined}
        isRefreshing={refreshMutation.isPending}
        cacheAge={valuation?.cacheInfo?.ageHours || null}
        trendMonths={trendMonths}
        onTrendMonthsChange={setTrendMonths}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Calculando valorización...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            No se pudo cargar la valorización de inventario. Por favor, intenta nuevamente.
          </AlertDescription>
        </Alert>
      )}

      {/* Content */}
      {valuation && !isLoading && (
        <>
          {/* Summary Cards */}
          <ValuationSummary
            valuation={valuation}
            categorySnapshots={categorySnapshots}
            onStatusClick={handleStatusClick}
          />

          {/* Category Breakdown */}
          {valuation.byCategory && valuation.byCategory.length > 0 && (
            <ValuationByCategory
              categories={valuation.byCategory}
              totalStockValue={valuation.totals.totalValueAtListPrice}
              onStatusClick={handleCategoryStatusClick}
              onCategoryTotalClick={handleCategoryTotalClick}
              selectedCategoryId={selectedCategoryId}
              selectedStatus={selectedStatus !== 'all' ? selectedStatus : null}
            />
          )}

          {/* Articles Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">
                  {selectedStatus === 'all'
                    ? 'Todos los Artículos'
                    : `Artículos: ${
                        selectedStatus === StockStatus.ACTIVE
                          ? 'Activos'
                          : selectedStatus === StockStatus.SLOW_MOVING
                            ? 'Movimiento Lento'
                            : selectedStatus === StockStatus.DEAD_STOCK
                              ? 'Stock Muerto'
                              : 'Nunca Vendidos'
                      }`}
                </h2>
                {selectedCategoryId !== null && (
                  <span className="text-muted-foreground text-sm">
                    en{' '}
                    {
                      valuation.byCategory?.find((c) => c.categoryId === selectedCategoryId)
                        ?.categoryName
                    }
                  </span>
                )}
                {(selectedStatus !== 'all' || selectedCategoryId !== null) && (
                  <button
                    onClick={() => {
                      setSelectedStatus('all');
                      setSelectedCategoryId(null);
                    }}
                    className="text-primary ml-2 text-xs hover:underline"
                  >
                    Limpiar filtro
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <p className="text-muted-foreground text-sm">
                  {sortedArticles.length} artículo{sortedArticles.length !== 1 ? 's' : ''}
                </p>
                {sortedArticles.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportCSV(sortedArticles)}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    Exportar CSV
                  </Button>
                )}
              </div>
            </div>

            {sortedArticles.length > 0 ? (
              <ValuationTable articles={sortedArticles} trendMonths={trendMonths} />
            ) : (
              <div className="text-muted-foreground rounded-lg border py-12 text-center">
                No hay artículos en esta categoría
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="text-muted-foreground border-t py-4 text-center text-xs">
            <p>Última actualización: {new Date(valuation.calculatedAt).toLocaleString('es-AR')}</p>
            <p className="mt-1">
              Los datos se actualizan automáticamente cada 24 horas
              {isAdmin() && ' o puedes forzar el recálculo usando el botón arriba'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
