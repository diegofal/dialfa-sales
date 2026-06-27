'use client';

import { Plus, Search, Filter, Package, History, BarChart3, Info } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArticleDialog } from '@/components/articles/ArticleDialog';
import { ArticlesTable } from '@/components/articles/ArticlesTable';
import { SalesAnalyticsTab } from '@/components/articles/SalesAnalyticsTab';
import { StockMovementsTable } from '@/components/articles/StockMovementsTable';
import { SupplierOrderPanel } from '@/components/articles/SupplierOrderPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROUTES } from '@/lib/constants/routes';
import { type SoldInPeriod, useArticles, useDeleteArticle } from '@/lib/hooks/domain/useArticles';
import { useCategories } from '@/lib/hooks/domain/useCategories';
import { useContainerPlanner } from '@/lib/hooks/domain/useContainerPlanner';
import { useImportCsvToOrder } from '@/lib/hooks/domain/useImportCsvToOrder';
import { useStockMovements } from '@/lib/hooks/domain/useStockMovements';
import { useSupplierOrderDraft } from '@/lib/hooks/domain/useSupplierOrderDraft';
import { usePagination } from '@/lib/hooks/generic/usePagination';
import { useAuthStore } from '@/store/authStore';
import { Article } from '@/types/article';
import { StockStatus } from '@/types/stockValuation';

const formatArs = (n: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const formatNum = (n: number): string => new Intl.NumberFormat('es-AR').format(n);

// Remembers, per browser, whether the user dismissed the supplier-order panel.
// The draft itself stays in the DB; this only controls panel visibility so the
// toggle stays off across refreshes when explicitly turned off.
const SUPPLIER_MODE_HIDDEN_KEY = 'supplier-order-mode-hidden';

const isSupplierModeHidden = (): boolean =>
  typeof window !== 'undefined' && localStorage.getItem(SUPPLIER_MODE_HIDDEN_KEY) === 'true';

const setSupplierModeHidden = (hidden: boolean): void => {
  if (typeof window === 'undefined') return;
  if (hidden) {
    localStorage.setItem(SUPPLIER_MODE_HIDDEN_KEY, 'true');
  } else {
    localStorage.removeItem(SUPPLIER_MODE_HIDDEN_KEY);
  }
};

export default function ArticlesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin, isVendedor } = useAuthStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [abcFilter, setAbcFilter] = useState<string>('all');
  const [salesSortFilter, setSalesSortFilter] = useState<string>('none');
  const [trendMonths, setTrendMonths] = useState<number>(12);
  const [soldInPeriod, setSoldInPeriod] = useState<SoldInPeriod | 'all'>(() => {
    const fromUrl = searchParams.get('soldInPeriod');
    const valid: readonly string[] = [
      'current-month',
      'last-month',
      'last-3-months',
      'last-6-months',
      'last-12-months',
    ];
    return fromUrl && valid.includes(fromUrl) ? (fromUrl as SoldInPeriod) : 'all';
  });
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatus | 'all'>(() => {
    const fromUrl = searchParams.get('stockStatus');
    const valid: readonly string[] = Object.values(StockStatus);
    return fromUrl && valid.includes(fromUrl) ? (fromUrl as StockStatus) : 'all';
  });
  const [supplierOrderTrendMonths, setSupplierOrderTrendMonths] = useState<number>(12);

  // Supplier order mode
  const [supplierOrderMode, setSupplierOrderMode] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<number>>(new Set());

  // Supplier order draft hook with trendMonths
  const supplierOrder = useSupplierOrderDraft(supplierOrderTrendMonths);
  const { importCsv, isImporting } = useImportCsvToOrder(
    supplierOrder.addItems,
    supplierOrderTrendMonths
  );

  // Reactive container planner — recomputes the order live from strategy controls.
  const planner = useContainerPlanner({
    trendMonths: supplierOrderTrendMonths,
    enabled: supplierOrderMode,
    draft: supplierOrder,
  });

  // Auto-restore supplier order mode when a draft has items, unless the user
  // explicitly dismissed the panel (persisted per browser).
  useEffect(() => {
    if (!supplierOrder.isLoading && supplierOrder.hasDraft && !isSupplierModeHidden()) {
      setSupplierOrderMode(true);
      setSelectedArticleIds(new Set(supplierOrder.draftArticleIds));
    }
  }, [supplierOrder.isLoading, supplierOrder.hasDraft]);

  const canCreateEdit = isAdmin() || isVendedor();

  // Get initial tab from URL or default to 'articles'
  const [currentTab, setCurrentTab] = useState<string>(() => {
    return searchParams.get('tab') || 'articles';
  });

  // Sync tab with URL on mount and when searchParams change
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || 'articles';
    if (tabFromUrl !== currentTab) {
      setCurrentTab(tabFromUrl);
    }
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (newTab: string) => {
    setCurrentTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.push(`${pathname}?${params.toString()}`);
  };

  const { pagination, setPage, setPageSize, setSorting } = usePagination(10);

  const {
    pagination: movementsPagination,
    setPage: setMovementsPage,
    setPageSize: setMovementsPageSize,
  } = usePagination(25);

  const { data: categories } = useCategories({ activeOnly: true });

  const { data, isLoading } = useArticles({
    activeOnly: false, // Include discontinued articles
    searchTerm: searchTerm || undefined,
    categoryId: categoryFilter !== 'all' ? parseInt(categoryFilter) : undefined,
    lowStockOnly: stockFilter === 'low' ? true : undefined,
    hasStockOnly: stockFilter === 'available' ? true : undefined,
    zeroStockOnly: stockFilter === 'zero' ? true : undefined,
    pageNumber: pagination.pageNumber,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortDescending: pagination.sortDescending,
    includeABC: true,
    includeTrends: true,
    abcFilter: abcFilter !== 'all' ? abcFilter : undefined,
    salesSort: salesSortFilter !== 'none' ? salesSortFilter : undefined,
    trendMonths,
    soldInPeriod: soldInPeriod !== 'all' ? soldInPeriod : undefined,
    stockStatusFilter: stockStatusFilter !== 'all' ? stockStatusFilter : undefined,
  });

  const { data: movementsData, isLoading: isLoadingMovements } = useStockMovements({
    pageNumber: movementsPagination.pageNumber,
    pageSize: movementsPagination.pageSize,
  });

  const deleteMutation = useDeleteArticle();

  const handleNewArticle = () => {
    setSelectedArticle(null);
    setDialogOpen(true);
  };

  const handleEditArticle = (article: Article) => {
    // Edit is now handled on the dedicated detail page.
    router.push(`${ROUTES.ARTICLES}/${article.id}`);
  };

  const handleDeleteArticle = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedArticle(null);
    }
  };

  const handleToggleSelect = (article: Article) => {
    setSelectedArticleIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(article.id)) {
        updated.delete(article.id);
        supplierOrder.removeItem(article.id);
        planner.removeLine(article.id); // keep it out of the auto pool
      } else {
        updated.add(article.id);
        const suggestedQty = supplierOrder.getSuggestedQuantity(article);
        supplierOrder.addItem(article, suggestedQty); // show immediately
        planner.setManualQuantity(article.id, suggestedQty); // pin as manual override
      }
      return updated;
    });
  };

  const handleSupplierOrderModeToggle = (checked: boolean) => {
    setSupplierOrderMode(checked);
    // Persist the user's intent so it survives a refresh. The draft stays in
    // the DB either way; this only controls panel visibility.
    setSupplierModeHidden(!checked);
    if (checked) {
      // Re-entering the panel: reflect the existing draft's selection
      setSelectedArticleIds(new Set(supplierOrder.draftArticleIds));
    }
  };

  const handleViewSupplierOrder = () => {
    if (supplierOrder.currentDraftId) {
      router.push(`${ROUTES.SUPPLIER_ORDERS}/${supplierOrder.currentDraftId}`);
    }
  };

  const activeFiltersCount = [
    categoryFilter !== 'all',
    stockFilter !== 'all',
    abcFilter !== 'all',
    salesSortFilter !== 'none',
    soldInPeriod !== 'all',
    stockStatusFilter !== 'all',
    searchTerm.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Artículos</h1>
          <p className="text-muted-foreground">Gestión de artículos e inventario</p>
        </div>
        <div className="flex items-center gap-4">
          {canCreateEdit && (
            <>
              {/* Supplier Order Mode Toggle */}
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Label htmlFor="supplier-mode" className="cursor-pointer text-sm">
                  Pedido a Proveedor
                </Label>
                <Switch
                  id="supplier-mode"
                  checked={supplierOrderMode}
                  onCheckedChange={handleSupplierOrderModeToggle}
                />
              </div>

              <Button onClick={handleNewArticle} disabled={supplierOrderMode}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Artículo
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="articles" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Artículos
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Movimientos de Stock
          </TabsTrigger>
          <TabsTrigger value="sales-analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Análisis de Ventas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            {/* Search */}
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por código, descripción o categoría..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1); // Reset to first page when searching
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-2 md:w-[200px]">
              <label className="text-sm font-medium">Categoría</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories?.data?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stock Filter */}
            <div className="space-y-2 md:w-[180px]">
              <label className="text-sm font-medium">Stock</label>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="available">📦 Con Stock (&gt;0)</SelectItem>
                  <SelectItem value="low">⚠️ Stock Bajo</SelectItem>
                  <SelectItem value="zero">🚫 Sin Stock (=0)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ABC Filter */}
            <div className="space-y-2 md:w-[180px]">
              <label className="text-sm font-medium">Clasificación ABC</label>
              <Select value={abcFilter} onValueChange={setAbcFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="A">🟢 Clase A (Top 80%)</SelectItem>
                  <SelectItem value="B">🔵 Clase B (80-95%)</SelectItem>
                  <SelectItem value="C">⚫ Clase C (95-100%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stock Status Filter */}
            <div className="space-y-2 md:w-[180px]">
              <label className="text-sm font-medium">Estado de stock</label>
              <Select
                value={stockStatusFilter}
                onValueChange={(v) => {
                  setStockStatusFilter(v as StockStatus | 'all');
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value={StockStatus.ACTIVE}>🟢 Activo</SelectItem>
                  <SelectItem value={StockStatus.SLOW_MOVING}>🟡 Mov. Lento</SelectItem>
                  <SelectItem value={StockStatus.DEAD_STOCK}>🔴 Stock Muerto</SelectItem>
                  <SelectItem value={StockStatus.NEVER_SOLD}>⚪ Nunca Vendido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sold In Period Filter */}
            <div className="space-y-2 md:w-[180px]">
              <label className="text-sm font-medium">Vendido en</label>
              <Select
                value={soldInPeriod}
                onValueChange={(v) => {
                  setSoldInPeriod(v as SoldInPeriod | 'all');
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cualquier período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cualquier período</SelectItem>
                  <SelectItem value="current-month">📅 Mes actual</SelectItem>
                  <SelectItem value="last-month">📆 Mes anterior</SelectItem>
                  <SelectItem value="last-3-months">📈 Últimos 3 meses</SelectItem>
                  <SelectItem value="last-6-months">📈 Últimos 6 meses</SelectItem>
                  <SelectItem value="last-12-months">📈 Últimos 12 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sales Sort Filter */}
            <div className="space-y-2 md:w-[200px]">
              <label className="text-sm font-medium">Ordenar por Ventas</label>
              <Select value={salesSortFilter} onValueChange={setSalesSortFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin orden" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin orden específico</SelectItem>
                  <SelectItem value="most">📈 Más vendidos primero</SelectItem>
                  <SelectItem value="least">📉 Menos vendidos primero</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Trend Months Filter */}
            <div className="space-y-2 md:w-[180px]">
              <label className="text-sm font-medium">Tendencia (meses)</label>
              <Select
                value={trendMonths.toString()}
                onValueChange={(v) => setTrendMonths(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="12 meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="18">18 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setStockFilter('all');
                  setAbcFilter('all');
                  setSalesSortFilter('none');
                  setSoldInPeriod('all');
                  setStockStatusFilter('all');
                  setPage(1);
                }}
              >
                <Filter className="mr-2 h-4 w-4" />
                Limpiar ({activeFiltersCount})
              </Button>
            )}
          </div>

          {/* Stats */}
          {data && (
            <div className="flex flex-wrap gap-4">
              <Badge variant="secondary" className="px-3 py-1.5 text-sm">
                Total: {data.pagination.total} artículos
              </Badge>
              {abcFilter !== 'all' && (
                <Badge
                  variant="outline"
                  className={`px-3 py-1.5 text-sm ${
                    abcFilter === 'A'
                      ? 'border-green-500 text-green-700 dark:text-green-400'
                      : abcFilter === 'B'
                        ? 'border-blue-500 text-blue-700 dark:text-blue-400'
                        : 'border-gray-500 text-gray-700 dark:text-gray-400'
                  }`}
                >
                  Clase {abcFilter}: {data.pagination.total} artículos
                </Badge>
              )}
              {salesSortFilter !== 'none' && (
                <Badge variant="outline" className="px-3 py-1.5 text-sm">
                  {salesSortFilter === 'most' ? '📈 Más vendidos' : '📉 Menos vendidos'}
                </Badge>
              )}
              {soldInPeriod !== 'all' && (
                <Badge variant="outline" className="px-3 py-1.5 text-sm">
                  {(() => {
                    const periodLabel =
                      soldInPeriod === 'current-month'
                        ? 'mes actual'
                        : soldInPeriod === 'last-month'
                          ? 'mes anterior'
                          : soldInPeriod === 'last-3-months'
                            ? 'últimos 3 meses'
                            : soldInPeriod === 'last-6-months'
                              ? 'últimos 6 meses'
                              : 'últimos 12 meses';
                    const total = data.totalUnitsSoldInPeriod;
                    if (total !== undefined) {
                      const formatted = new Intl.NumberFormat('es-AR').format(total);
                      return `📅 ${formatted} unidades vendidas en ${periodLabel}`;
                    }
                    return `📅 Vendidos en ${periodLabel}`;
                  })()}
                </Badge>
              )}
              {stockFilter === 'low' && (
                <Badge variant="destructive" className="px-3 py-1.5 text-sm">
                  {data.data.filter((a) => a.isLowStock).length} con stock bajo
                </Badge>
              )}
            </div>
          )}

          {/* Sales summary (only when a period filter is active) */}
          {soldInPeriod !== 'all' && data?.salesSummaryInPeriod && (
            <Card>
              <CardContent className="py-4">
                <p className="text-muted-foreground mb-3 text-sm font-medium">
                  Resumen de ventas del período
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">Facturado (c/IVA)</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {formatArs(data.salesSummaryInPeriod.totalWithIva)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">Neto (s/IVA)</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {formatArs(data.salesSummaryInPeriod.netAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">Unidades</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {formatNum(data.salesSummaryInPeriod.unitsSold)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">Facturas</p>
                    <p className="text-xl font-semibold tabular-nums">
                      {formatNum(data.salesSummaryInPeriod.invoiceCount)}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground mt-3 flex items-start gap-1.5 text-xs">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Suma de los {data.pagination.total} artículos filtrados (datos SPISA, NC
                    restadas). Coincide con &quot;Facturado (Mes)&quot; del dashboard solo sin
                    filtros de artículo y con período = mes actual (esa métrica usa otra fuente:
                    xERP).
                  </span>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Cargando artículos...</p>
            </div>
          ) : data && data.data.length > 0 ? (
            <>
              <ArticlesTable
                articles={data.data}
                onEdit={handleEditArticle}
                onDelete={handleDeleteArticle}
                currentSortBy={pagination.sortBy}
                currentSortDescending={pagination.sortDescending}
                onSort={setSorting}
                trendMonths={trendMonths}
                showSoldInPeriod={soldInPeriod !== 'all'}
                soldInPeriodLabel={
                  soldInPeriod === 'current-month'
                    ? 'Vendido (mes act.)'
                    : soldInPeriod === 'last-month'
                      ? 'Vendido (mes ant.)'
                      : soldInPeriod === 'last-3-months'
                        ? 'Vendido (3m)'
                        : soldInPeriod === 'last-6-months'
                          ? 'Vendido (6m)'
                          : soldInPeriod === 'last-12-months'
                            ? 'Vendido (12m)'
                            : 'Vendido en período'
                }
                selectionMode={supplierOrderMode}
                selectedIds={selectedArticleIds}
                onToggleSelect={handleToggleSelect}
              />
              <div className="mt-4">
                <Pagination
                  totalCount={data.pagination.total}
                  currentPage={data.pagination.page}
                  pageSize={data.pagination.limit}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </>
          ) : (
            <div className="text-muted-foreground py-12 text-center">
              No se encontraron artículos
            </div>
          )}

          {/* Supplier Order Panel */}
          {supplierOrderMode && (
            <div className="mt-6">
              <SupplierOrderPanel
                items={supplierOrder.getItems()}
                totalEstimatedTime={supplierOrder.getTotalEstimatedTime()}
                trendMonths={supplierOrderTrendMonths}
                onTrendMonthsChange={setSupplierOrderTrendMonths}
                onQuantityChange={planner.setManualQuantity}
                onRemove={(articleId) => {
                  supplierOrder.removeItem(articleId);
                  planner.removeLine(articleId);
                  setSelectedArticleIds((prev) => {
                    const updated = new Set(prev);
                    updated.delete(articleId);
                    return updated;
                  });
                }}
                onClear={async () => {
                  await planner.clear();
                  setSelectedArticleIds(new Set());
                  setSupplierOrderMode(false);
                  // Draft is gone — reset the dismissal flag to its default
                  setSupplierModeHidden(false);
                }}
                onViewOrder={supplierOrder.currentDraftId ? handleViewSupplierOrder : undefined}
                onImportCsv={importCsv}
                categories={
                  categories?.data?.map((c) => ({ id: Number(c.id), name: c.name })) ?? []
                }
                strategy={planner.strategy}
                onModeChange={planner.setMode}
                onCoverageMonthsChange={planner.setCoverageMonths}
                onCapacityChange={planner.setCapacityKg}
                onExcludeNoRotationChange={planner.setExcludeNoRotation}
                onMaxStockMonthsChange={planner.setMaxStockMonths}
                onCategoryIdsChange={planner.setCategoryIds}
                onRegenerate={planner.regenerate}
                onResetLine={planner.resetLine}
                overriddenIds={planner.overriddenIds}
                isSaving={supplierOrder.isSaving}
                isLoading={supplierOrder.isLoading}
                isImporting={isImporting}
                isComputing={planner.isCatalogLoading}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          {/* Stats */}
          {movementsData && (
            <div className="flex flex-wrap gap-4">
              <Badge variant="secondary" className="px-3 py-1.5 text-sm">
                Total: {movementsData.pagination.total} movimientos
              </Badge>
            </div>
          )}

          {/* Movements Table */}
          {isLoadingMovements ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Cargando movimientos...</p>
            </div>
          ) : movementsData && movementsData.data.length > 0 ? (
            <>
              <StockMovementsTable movements={movementsData.data} />
              <div className="mt-4">
                <Pagination
                  totalCount={movementsData.pagination.total}
                  currentPage={movementsData.pagination.page}
                  pageSize={movementsData.pagination.limit}
                  onPageChange={setMovementsPage}
                  onPageSizeChange={setMovementsPageSize}
                />
              </div>
            </>
          ) : (
            <div className="text-muted-foreground py-12 text-center">
              No se encontraron movimientos de stock
            </div>
          )}
        </TabsContent>

        <TabsContent value="sales-analytics" className="space-y-4">
          <SalesAnalyticsTab />
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <ArticleDialog open={dialogOpen} onOpenChange={handleDialogClose} article={selectedArticle} />
    </div>
  );
}
