'use client';

import { useState } from 'react';
import { Plus, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/lib/hooks/usePagination';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DeliveryNotesTable } from '@/components/deliveryNotes/DeliveryNotesTable';
import { DeliveryNoteDialog } from '@/components/deliveryNotes/DeliveryNoteDialog';
import { useDeliveryNotes, useDeleteDeliveryNote } from '@/lib/hooks/useDeliveryNotes';
import { useRouter } from 'next/navigation';
import { useQuickDeliveryNoteTabs } from '@/lib/hooks/useQuickDeliveryNoteTabs';

export default function DeliveryNotesPage() {
  const router = useRouter();
  const { removeTab, tabs } = useQuickDeliveryNoteTabs();
  const [filters, setFilters] = useState({
    salesOrderId: undefined as number | undefined,
    fromDate: '',
    toDate: '',
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { pagination, setPage, setPageSize, setSorting } = usePagination(10);

  const { data, isLoading } = useDeliveryNotes({
    ...filters,
    pageNumber: pagination.pageNumber,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortDescending: pagination.sortDescending,
  });

  const deleteDeliveryNoteMutation = useDeleteDeliveryNote();

  const activeFiltersCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== ''
  ).length;

  const handleClearFilters = () => {
    setFilters({
      salesOrderId: undefined,
      fromDate: '',
      toDate: '',
    });
  };

  const handleViewDeliveryNote = (id: number) => {
    router.push(`/dashboard/delivery-notes/${id}`);
  };

  const handleDeleteDeliveryNote = (id: number) => {
    deleteDeliveryNoteMutation.mutate(id, {
      onSuccess: () => {
        // Remove tab from sidebar if it exists (find by deliveryNoteId)
        const tabToRemove = tabs.find(tab => tab.deliveryNoteId === id);
        if (tabToRemove) {
          removeTab(tabToRemove.id);
        }
      },
    });
  };

  const totalDeliveryNotes = data?.pagination.total || 0;
  const totalPackages = data?.data.reduce((sum, d) => sum + (d.packagesCount || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Remitos</h1>
          <p className="text-muted-foreground">Gestiona los remitos de entrega</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Remito
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Remitos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDeliveryNotes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bultos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPackages}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.data.filter(d => {
                const deliveryDate = new Date(d.deliveryDate);
                const now = new Date();
                return deliveryDate.getMonth() === now.getMonth() && 
                       deliveryDate.getFullYear() === now.getFullYear();
              }).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <CardTitle>Filtros</CardTitle>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary">{activeFiltersCount}</Badge>
              )}
            </div>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="mr-2 h-4 w-4" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Desde</label>
              <Input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Hasta</label>
              <Input
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Notes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Remitos</CardTitle>
          <CardDescription>
            {totalDeliveryNotes} remito{totalDeliveryNotes !== 1 ? 's' : ''} encontrado
            {totalDeliveryNotes !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando remitos...
            </div>
          ) : data && data.data.length > 0 ? (
            <>
              <DeliveryNotesTable
                deliveryNotes={data.data}
                onViewDeliveryNote={handleViewDeliveryNote}
                onDeleteDeliveryNote={handleDeleteDeliveryNote}
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
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron remitos
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <DeliveryNoteDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}


