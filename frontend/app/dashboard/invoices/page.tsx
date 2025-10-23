'use client';

import { useState } from 'react';
import { Plus, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/lib/hooks/usePagination';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InvoicesTable } from '@/components/invoices/InvoicesTable';
import { useInvoices, useCancelInvoice, usePrintInvoice } from '@/lib/hooks/useInvoices';
import { useRouter } from 'next/navigation';

export default function InvoicesPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({
    clientId: undefined as number | undefined,
    fromDate: '',
    toDate: '',
    isPrinted: undefined as boolean | undefined,
    isCancelled: undefined as boolean | undefined,
    activeOnly: true,
  });

  const { pagination, setPage, setPageSize, setSorting } = usePagination(10);

  const { data, isLoading } = useInvoices({
    ...filters,
    pageNumber: pagination.pageNumber,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortDescending: pagination.sortDescending,
  });

  const cancelInvoiceMutation = useCancelInvoice();
  const printInvoiceMutation = usePrintInvoice();

  const activeFiltersCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== '' && v !== true
  ).length;

  const handleClearFilters = () => {
    setFilters({
      clientId: undefined,
      fromDate: '',
      toDate: '',
      isPrinted: undefined,
      isCancelled: undefined,
      activeOnly: true,
    });
  };

  const handleViewInvoice = (id: number) => {
    router.push(`/dashboard/invoices/${id}`);
  };

  const handleCancelInvoice = (id: number, reason: string) => {
    cancelInvoiceMutation.mutate({ id, data: { cancellationReason: reason } });
  };

  const handlePrintInvoice = (id: number) => {
    printInvoiceMutation.mutate(id);
  };

  const handleCreateInvoice = () => {
    router.push('/dashboard/invoices/new');
  };

  const totalInvoices = data?.pagination.total || 0;
  const printedCount = data?.data.filter((i) => i.isPrinted).length || 0;
  const cancelledCount = data?.data.filter((i) => i.isCancelled).length || 0;
  const totalAmount = data?.data.reduce((sum, i) => sum + i.totalAmount, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturas</h1>
          <p className="text-muted-foreground">Gestiona las facturas del sistema</p>
        </div>
        <Button onClick={handleCreateInvoice}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Factura
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Facturas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impresas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{printedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cancelledCount}</div>
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
              }).format(totalAmount)}
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
          <div className="grid gap-4 md:grid-cols-4">
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
                  checked={filters.isPrinted === true}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      isPrinted: e.target.checked ? true : undefined,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium">Solo impresas</span>
              </label>
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.isCancelled === false}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      isCancelled: e.target.checked ? false : undefined,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium">Excluir canceladas</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Facturas</CardTitle>
          <CardDescription>
            {totalInvoices} factura{totalInvoices !== 1 ? 's' : ''} encontrada
            {totalInvoices !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando facturas...
            </div>
          ) : data && data.data.length > 0 ? (
            <>
              <InvoicesTable
                invoices={data.data}
                onViewInvoice={handleViewInvoice}
                onCancelInvoice={handleCancelInvoice}
                onPrintInvoice={handlePrintInvoice}
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
              No se encontraron facturas
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


