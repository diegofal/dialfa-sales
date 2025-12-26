'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Plus, Search, Filter, Package, History, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePagination } from '@/lib/hooks/usePagination';
import { useArticles, useDeleteArticle } from '@/lib/hooks/useArticles';
import { useCategories } from '@/lib/hooks/useCategories';
import { useStockMovements } from '@/lib/hooks/useStockMovements';
import { useSupplierOrderDraft } from '@/lib/hooks/useSupplierOrderDraft';
import { useUpdateSupplierOrderStatus } from '@/lib/hooks/useSupplierOrders';
import { ArticlesTable } from '@/components/articles/ArticlesTable';
import { ArticleDialog } from '@/components/articles/ArticleDialog';
import { StockMovementsTable } from '@/components/articles/StockMovementsTable';
import { SupplierOrderPanel } from '@/components/articles/SupplierOrderPanel';
import { Article } from '@/types/article';
import { useAuthStore } from '@/store/authStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export default function ArticlesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAdmin } = useAuthStore();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [abcFilter, setAbcFilter] = useState<string>('all');
  const [salesSortFilter, setSalesSortFilter] = useState<string>('none');
  const [trendMonths, setTrendMonths] = useState<number>(12);
  const [supplierOrderTrendMonths, setSupplierOrderTrendMonths] = useState<number>(12);

  // Supplier order mode
  const [supplierOrderMode, setSupplierOrderMode] = useState(false);
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<number>>(new Set());
  
  // Supplier order draft hook with trendMonths
  const supplierOrder = useSupplierOrderDraft(supplierOrderTrendMonths);
  const updateStatusMutation = useUpdateSupplierOrderStatus();

  const canCreateEdit = isAdmin();
  
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

  const {
    pagination,
    setPage,
    setPageSize,
    setSorting,
  } = usePagination(10);

  const {
    pagination: movementsPagination,
    setPage: setMovementsPage,
    setPageSize: setMovementsPageSize,
  } = usePagination(25);

  const { data: categories } = useCategories({ activeOnly: true });

  const { data, isLoading } = useArticles({
    activeOnly: true,
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
    abcFilter: abcFilter !== 'all' ? abcFilter : undefined,
    salesSort: salesSortFilter !== 'none' ? salesSortFilter : undefined,
    trendMonths,
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
    setSelectedArticle(article);
    setDialogOpen(true);
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
        // Remove from both sets
        updated.delete(article.id);
        supplierOrder.removeItem(article.id);
      } else {
        // Add to both
        updated.add(article.id);
        const suggestedQty = supplierOrder.getSuggestedQuantity(article);
        supplierOrder.addItem(article, suggestedQty);
      }
      return updated;
    });
  };

  const handleSupplierOrderModeToggle = (checked: boolean) => {
    setSupplierOrderMode(checked);
    if (!checked) {
      // Clear selection when turning off
      setSelectedArticleIds(new Set());
      supplierOrder.clear();
    }
  };

  const handleCreateSupplierOrder = async () => {
    if (supplierOrder.getTotalItems() === 0) {
      toast.error('Agrega al menos un artículo para crear el pedido');
      return;
    }
    
    if (!supplierOrder.currentDraftId) {
      toast.error('Error: No hay borrador activo');
      return;
    }
    
    try {
      // Change status from draft to confirmed
      await updateStatusMutation.mutateAsync({
        id: supplierOrder.currentDraftId,
        status: 'confirmed',
      });
      
      // Clear the draft and redirect
      supplierOrder.clear();
      setSupplierOrderMode(false);
      setSelectedArticleIds(new Set());
      
      toast.success('Pedido confirmado exitosamente');
      router.push(`/dashboard/supplier-orders/${supplierOrder.currentDraftId}`);
    } catch (error) {
      toast.error('Error al confirmar el pedido');
    }
  };

  const activeFiltersCount = [
    categoryFilter !== 'all',
    stockFilter !== 'all',
    abcFilter !== 'all',
    salesSortFilter !== 'none',
    searchTerm.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Artículos</h1>
          <p className="text-muted-foreground">
            Gestión de artículos e inventario
          </p>
        </div>
        <div className="flex items-center gap-4">
          {canCreateEdit && (
            <>
              {/* Supplier Order Mode Toggle */}
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
                <Label htmlFor="supplier-mode" className="text-sm cursor-pointer">
                  Pedido a Proveedor
                </Label>
                <Switch
                  id="supplier-mode"
                  checked={supplierOrderMode}
                  onCheckedChange={handleSupplierOrderModeToggle}
                />
              </div>
              
              <Button onClick={handleNewArticle} disabled={supplierOrderMode}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Artículo
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="articles" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Artículos
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Movimientos de Stock
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            {/* Search */}
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
              <Select value={trendMonths.toString()} onValueChange={(v) => setTrendMonths(parseInt(v))}>
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
                  setPage(1);
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Limpiar ({activeFiltersCount})
              </Button>
            )}
          </div>

          {/* Stats */}
          {data && (
            <div className="flex gap-4 flex-wrap">
              <Badge variant="secondary" className="text-sm py-1.5 px-3">
                Total: {data.pagination.total} artículos
              </Badge>
              {abcFilter !== 'all' && (
                <Badge 
                  variant="outline" 
                  className={`text-sm py-1.5 px-3 ${
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
                <Badge variant="outline" className="text-sm py-1.5 px-3">
                  {salesSortFilter === 'most' ? '📈 Más vendidos' : '📉 Menos vendidos'}
                </Badge>
              )}
              {stockFilter === 'low' && (
                <Badge variant="destructive" className="text-sm py-1.5 px-3">
                  {data.data.filter((a) => a.isLowStock).length} con stock bajo
                </Badge>
              )}
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
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
            <div className="text-center py-12 text-muted-foreground">
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
                onQuantityChange={supplierOrder.updateQuantity}
                onRemove={(articleId) => {
                  supplierOrder.removeItem(articleId);
                  setSelectedArticleIds((prev) => {
                    const updated = new Set(prev);
                    updated.delete(articleId);
                    return updated;
                  });
                }}
                onClear={() => {
                  supplierOrder.clear();
                  setSelectedArticleIds(new Set());
                }}
                onCreateOrder={handleCreateSupplierOrder}
                isSaving={supplierOrder.isSaving}
                isLoading={supplierOrder.isLoading}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          {/* Stats */}
          {movementsData && (
            <div className="flex gap-4 flex-wrap">
              <Badge variant="secondary" className="text-sm py-1.5 px-3">
                Total: {movementsData.pagination.total} movimientos
              </Badge>
            </div>
          )}

          {/* Movements Table */}
          {isLoadingMovements ? (
            <div className="flex justify-center items-center py-12">
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
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron movimientos de stock
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <ArticleDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        article={selectedArticle}
      />
    </div>
  );
}


