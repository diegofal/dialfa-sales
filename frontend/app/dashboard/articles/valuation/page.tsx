'use client';

import { useState } from 'react';
import { useStockValuation, useRefreshStockValuation } from '@/lib/hooks/useStockValuation';
import { ValuationSummary } from '@/components/articles/ValuationSummary';
import { ValuationTable } from '@/components/articles/ValuationTable';
import { ValuationFilters } from '@/components/articles/ValuationFilters';
import { ValuationByCategory } from '@/components/articles/ValuationByCategory';
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
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
        let articles = selectedStatus === 'all'
          ? Object.values(valuation.byStatus).flatMap(group => group.articles)
          : valuation.byStatus[selectedStatus]?.articles || [];
        
        // Si hay categoría seleccionada, filtrar por ella
        if (selectedCategoryId !== null) {
          articles = articles.filter(a => a.categoryId === selectedCategoryId);
        }
        
        return articles;
      })()
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

          {/* Category Breakdown */}
          {valuation.byCategory && valuation.byCategory.length > 0 && (
            <ValuationByCategory 
              categories={valuation.byCategory} 
              totalStockValue={valuation.totals.totalStockValue}
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
                        selectedStatus === StockStatus.ACTIVE ? 'Activos' :
                        selectedStatus === StockStatus.SLOW_MOVING ? 'Movimiento Lento' :
                        selectedStatus === StockStatus.DEAD_STOCK ? 'Stock Muerto' :
                        'Nunca Vendidos'
                      }`
                  }
                </h2>
                {selectedCategoryId !== null && (
                  <span className="text-sm text-muted-foreground">
                    en {valuation.byCategory?.find(c => c.categoryId === selectedCategoryId)?.categoryName}
                  </span>
                )}
                {(selectedStatus !== 'all' || selectedCategoryId !== null) && (
                  <button 
                    onClick={() => { setSelectedStatus('all'); setSelectedCategoryId(null); }}
                    className="text-xs text-primary hover:underline ml-2"
                  >
                    Limpiar filtro
                  </button>
                )}
              </div>
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

