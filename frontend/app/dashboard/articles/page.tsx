'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Plus, Search, Filter, Package, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/lib/hooks/usePagination';
import { useArticles, useDeleteArticle } from '@/lib/hooks/useArticles';
import { useCategories } from '@/lib/hooks/useCategories';
import { useStockMovements } from '@/lib/hooks/useStockMovements';
import { ArticlesTable } from '@/components/articles/ArticlesTable';
import { ArticleDialog } from '@/components/articles/ArticleDialog';
import { StockMovementsTable } from '@/components/articles/StockMovementsTable';
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
    pageNumber: pagination.pageNumber,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortDescending: pagination.sortDescending,
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

  const activeFiltersCount = [
    categoryFilter !== 'all',
    stockFilter !== 'all',
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
        {canCreateEdit && (
          <Button onClick={handleNewArticle}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Artículo
          </Button>
        )}
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
                  <SelectItem value="low">Stock Bajo</SelectItem>
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


