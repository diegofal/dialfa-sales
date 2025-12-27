'use client';

import { useState } from 'react';
import { useStockValuation, useRefreshStockValuation } from '@/lib/hooks/useStockValuation';
import { ValuationSummary } from '@/components/articles/ValuationSummary';
import { ValuationTable } from '@/components/articles/ValuationTable';
import { ValuationFilters } from '@/components/articles/ValuationFilters';
import { StockClassificationConfig, StockStatus } from '@/types/stockValuation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuthStore } from '@/store/authStore';

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
  const [trendMonths, setTrendMonths] = useState<number>(6);

  // Usar trendMonths en la configuración para que se recarguen los datos
  const valuationConfig = {
    ...config,
    trendMonths: trendMonths,
  };

  const { data: valuation, isLoading, error } = useStockValuation(valuationConfig);
  const refreshMutation = useRefreshStockValuation();

  const handleRefresh = () => {
    refreshMutation.mutate(config);
  };

  const handleStatusClick = (status: StockStatus) => {
    setSelectedStatus(selectedStatus === status ? 'all' : status);
  };

  // Filtrar artículos según el status seleccionado
  const filteredArticles = valuation 
    ? selectedStatus === 'all'
      ? Object.values(valuation.byStatus).flatMap(group => group.articles)
      : valuation.byStatus[selectedStatus]?.articles || []
    : [];

  // Ordenar por valor de stock descendente
  const sortedArticles = [...filteredArticles].sort((a, b) => b.stockValue - a.stockValue);

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
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
          <ValuationSummary valuation={valuation} onStatusClick={handleStatusClick} />

          {/* Articles Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {selectedStatus === 'all' 
                  ? 'Todos los Artículos' 
                  : `Artículos: ${
                      selectedStatus === StockStatus.ACTIVE ? 'Activos' :
                      selectedStatus === StockStatus.SLOW_MOVING ? 'Movimiento Lento' :
                      selectedStatus === StockStatus.DEAD_STOCK ? 'Stock Muerto' :
                      'Nunca Vendidos'
                    }`
                }
              </h2>
              <p className="text-sm text-muted-foreground">
                {sortedArticles.length} artículo{sortedArticles.length !== 1 ? 's' : ''}
              </p>
            </div>

            {sortedArticles.length > 0 ? (
              <ValuationTable articles={sortedArticles} trendMonths={trendMonths} />
            ) : (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                No hay artículos en esta categoría
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="text-xs text-muted-foreground text-center py-4 border-t">
            <p>
              Última actualización: {new Date(valuation.calculatedAt).toLocaleString('es-AR')}
            </p>
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

