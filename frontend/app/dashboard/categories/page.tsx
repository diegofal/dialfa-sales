'use client';

import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { CategoriesTable } from '@/components/categories/CategoriesTable';
import { CategoryDialog } from '@/components/categories/CategoryDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { LoadingSpinner } from '@/components/ui/spinner';
import { useCategories } from '@/lib/hooks/useCategories';
import { usePagination } from '@/lib/hooks/usePagination';

export default function CategoriesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { pagination, setPage, setPageSize, setSorting } = usePagination(10);

  const { data, isLoading } = useCategories({
    activeOnly: false,
    pageNumber: pagination.pageNumber,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortDescending: pagination.sortDescending,
    searchTerm,
  });

  const handleEdit = (id: number) => {
    setEditingId(id);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categorías</h1>
          <p className="text-muted-foreground">Gestiona las categorías de productos</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Categoría
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Categorías</CardTitle>
              <CardDescription>
                {data?.pagination.total || 0} categorías registradas
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
              <Input
                placeholder="Buscar categorías..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <LoadingSpinner size="md" className="py-8" />}

          {data && data.data.length > 0 && (
            <>
              <CategoriesTable
                categories={data.data}
                onEdit={handleEdit}
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
          )}

          {data && data.data.length === 0 && !isLoading && (
            <div className="text-muted-foreground py-8 text-center">
              No se encontraron categorías
            </div>
          )}
        </CardContent>
      </Card>

      <CategoryDialog isOpen={isDialogOpen} onClose={handleCloseDialog} categoryId={editingId} />
    </div>
  );
}
