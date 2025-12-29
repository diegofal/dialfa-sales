'use client';

import { useState } from 'react';
import { useClients } from '@/lib/hooks/useClients';
import { useClientClassification } from '@/lib/hooks/useClientClassification';
import { usePagination } from '@/lib/hooks/usePagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import ClientsTable from '@/components/clients/ClientsTable';
import ClientDialog from '@/components/clients/ClientDialog';
import ClientClassificationSummary from '@/components/clients/ClientClassificationSummary';
import { ClientClassificationFilters } from '@/components/clients/ClientClassificationFilters';
import type { ClientDto } from '@/types/api';
import { ClientStatus, ClientClassificationConfig } from '@/types/clientClassification';

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientDto | null>(null);
  const [trendMonths, setTrendMonths] = useState(12);
  const [selectedClassification, setSelectedClassification] = useState<ClientStatus | 'all'>('all');
  const [classificationConfig, setClassificationConfig] = useState<ClientClassificationConfig>({
    activeThresholdDays: 90,
    slowMovingThresholdDays: 180,
    inactiveThresholdDays: 365,
    minPurchasesPerMonth: 1,
    trendMonths: 12,
  });

  const {
    pagination,
    setPage,
    setPageSize,
    setSorting,
  } = usePagination(10);

  const { data, isLoading, error } = useClients({
    pageNumber: pagination.pageNumber,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortDescending: pagination.sortDescending,
    searchTerm,
    includeTrends: true,
    trendMonths,
    includeClassification: true,
    classificationStatus: selectedClassification !== 'all' ? selectedClassification : undefined,
  });

  // Get classification summary for the cards with current config
  const { data: classificationData } = useClientClassification({
    ...classificationConfig,
    trendMonths: classificationConfig.trendMonths,
  });

  // Calculate summary from classification data
  const classificationSummary = classificationData ? {
    active: { 
      count: classificationData.byStatus.active.count, 
      revenue: classificationData.byStatus.active.totalRevenue 
    },
    slow_moving: { 
      count: classificationData.byStatus.slow_moving.count, 
      revenue: classificationData.byStatus.slow_moving.totalRevenue 
    },
    inactive: { 
      count: classificationData.byStatus.inactive.count, 
      revenue: classificationData.byStatus.inactive.totalRevenue 
    },
    never_purchased: { 
      count: classificationData.byStatus.never_purchased.count, 
      revenue: classificationData.byStatus.never_purchased.totalRevenue 
    },
  } : null;

  const handleCreate = () => {
    setSelectedClient(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (client: ClientDto) => {
    setSelectedClient(client);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedClient(null);
  };

  const handleClassificationClick = (status: ClientStatus | 'all') => {
    setSelectedClassification(status);
    setPage(1); // Reset to first page when filtering
  };

  const getFilterLabel = () => {
    if (selectedClassification === 'all') return 'Todos los Clientes';
    const labels = {
      [ClientStatus.ACTIVE]: 'Clientes Activos',
      [ClientStatus.SLOW_MOVING]: 'Clientes con Movimiento Lento',
      [ClientStatus.INACTIVE]: 'Clientes Inactivos',
      [ClientStatus.NEVER_PURCHASED]: 'Clientes sin Compras',
    };
    return labels[selectedClassification];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground mt-2">
            Gestión de clientes del sistema
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Classification Configuration */}
      <ClientClassificationFilters
        config={classificationConfig}
        onConfigChange={setClassificationConfig}
        cacheAge={classificationData?.cacheInfo?.ageHours || null}
        trendMonths={trendMonths}
        onTrendMonthsChange={setTrendMonths}
      />

      {/* Classification Summary Cards */}
      <ClientClassificationSummary
        summary={classificationSummary}
        selectedStatus={selectedClassification}
        onStatusClick={handleClassificationClick}
        isLoading={isLoading}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{getFilterLabel()}</CardTitle>
              <CardDescription>
                {data?.pagination.total || 0} cliente{data?.pagination.total !== 1 ? 's' : ''} 
                {selectedClassification !== 'all' && ' en esta categoría'}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1); // Reset to first page when searching
                }}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-600">
              Error al cargar los clientes
            </div>
          )}

          {data && data.data.length > 0 && (
            <>
              <ClientsTable
                clients={data.data}
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
            <div className="text-center py-8 text-muted-foreground">
              {selectedClassification === 'all' 
                ? 'No se encontraron clientes'
                : `No hay clientes en la categoría "${getFilterLabel()}"`
              }
            </div>
          )}
        </CardContent>
      </Card>

      <ClientDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        client={selectedClient}
      />
    </div>
  );
}
