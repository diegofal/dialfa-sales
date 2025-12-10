'use client';

import { useState } from 'react';
import { Plus, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/lib/hooks/usePagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SalesOrdersTable } from '@/components/salesOrders/SalesOrdersTable';
import { useSalesOrders, useDeleteSalesOrder } from '@/lib/hooks/useSalesOrders';
import { useRouter } from 'next/navigation';
import { useQuickCartTabs } from '@/lib/hooks/useQuickCartTabs';

export default function SalesOrdersPage() {
  const router = useRouter();
  const { removeTab, tabs } = useQuickCartTabs();
  const [filters, setFilters] = useState({
    status: '',
    clientId: undefined as number | undefined,
    fromDate: '',
    toDate: '',
    activeOnly: true,
  });

  const {
    pagination,
    setPage,
    setPageSize,
    setSorting,
  } = usePagination(10);

  const { data, isLoading } = useSalesOrders({
    ...filters,
    pageNumber: pagination.pageNumber,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortDescending: pagination.sortDescending,
  });
  const deleteOrderMutation = useDeleteSalesOrder();

  const activeFiltersCount = Object.values(filters).filter((v) => v && v !== true).length;

  const handleClearFilters = () => {
    setFilters({
      status: '',
      clientId: undefined,
      fromDate: '',
      toDate: '',
      activeOnly: true,
    });
  };

  const handleViewOrder = (id: number) => {
    router.push(`/dashboard/sales-orders/${id}`);
  };

  const handleDeleteOrder = (id: number) => {
    deleteOrderMutation.mutate(id, {
      onSuccess: () => {
        // Remove tab from sidebar if it exists (find by orderId)
        const tabToRemove = tabs.find(tab => tab.orderId === id);
        if (tabToRemove) {
          removeTab(tabToRemove.id);
        }
      },
    });
  };

  const handleCreateOrder = () => {
    router.push('/dashboard/sales-orders/new');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground">Gestiona los pedidos de venta</p>
        </div>
        <Button onClick={handleCreateOrder}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Pedido
        </Button>
      </div>

      {/* Statistics Cards - Comentado temporalmente */}
      {/* <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.pagination.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.data.filter((o) => o.status === 'PENDING').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.data.filter((o) => o.status === 'INVOICED').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Monto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS',
                minimumFractionDigits: 0,
              }).format(data?.data.reduce((sum, o) => sum + o.total, 0) || 0)}
            </div>
          </CardContent>
        </Card>
      </div> */}

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
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => setFilters({ ...filters, status: value === 'all' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendiente</SelectItem>
                  <SelectItem value="INVOICED">Facturado</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            <div className="flex items-end">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.activeOnly}
                  onChange={(e) =>
                    setFilters({ ...filters, activeOnly: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium">Solo activos</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
          <CardDescription>
            {data?.pagination.total || 0} pedido{(data?.pagination.total || 0) !== 1 ? 's' : ''} encontrado{(data?.pagination.total || 0) !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando pedidos...</div>
          ) : data && data.data.length > 0 ? (
            <>
              <SalesOrdersTable
                orders={data.data}
                onViewOrder={handleViewOrder}
                onDeleteOrder={handleDeleteOrder}
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
              No se encontraron pedidos
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


