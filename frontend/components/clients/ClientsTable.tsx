'use client';

import { useState } from 'react';
import type { ClientDto } from '@/types/api';
import { useDeleteClient } from '@/lib/hooks/useClients';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClickableTableRow } from '@/components/ui/clickable-table-row';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pencil, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ACTION_BUTTON_CONFIG } from '@/lib/constants/tableActions';
import { formatCuit } from '@/lib/utils';
import { SparklineWithTooltip } from '@/components/ui/sparkline';

interface ClientsTableProps {
  clients: ClientDto[];
  onEdit: (client: ClientDto) => void;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
}

export default function ClientsTable({ 
  clients, 
  onEdit,
  currentSortBy,
  currentSortDescending,
  onSort 
}: ClientsTableProps) {
  const [clientToDelete, setClientToDelete] = useState<ClientDto | null>(null);
  const deleteClientMutation = useDeleteClient();

  const handleDelete = () => {
    if (clientToDelete) {
      deleteClientMutation.mutate(clientToDelete.id);
      setClientToDelete(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate trend direction
  const calculateTrend = (salesTrend: number[] | undefined) => {
    if (!salesTrend || salesTrend.length < 2) return 'none';
    
    const midPoint = Math.floor(salesTrend.length / 2);
    const firstHalf = salesTrend.slice(0, midPoint);
    const secondHalf = salesTrend.slice(midPoint);
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (avgFirst === 0 && avgSecond === 0) return 'none';
    if (avgFirst === 0) return 'increasing';
    
    const changePercent = ((avgSecond - avgFirst) / avgFirst) * 100;
    
    if (changePercent > 20) return 'increasing';
    if (changePercent < -20) return 'decreasing';
    return 'stable';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />;
      case 'decreasing':
        return <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />;
      case 'stable':
        return <Minus className="h-3 w-3 text-blue-600 dark:text-blue-400" />;
      default:
        return <Minus className="h-3 w-3 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getClientStatusBadge = (status: ClientDto['clientStatus']) => {
    if (!status) return null;
    
    const badgeConfig = {
      active: { variant: 'default' as const, label: 'Activo', className: 'bg-green-600 hover:bg-green-700' },
      slow_moving: { variant: 'secondary' as const, label: 'Lento', className: 'bg-yellow-600 hover:bg-yellow-700 text-white' },
      inactive: { variant: 'destructive' as const, label: 'Inactivo', className: '' },
      never_purchased: { variant: 'outline' as const, label: 'Sin Compras', className: '' },
    };

    const config = badgeConfig[status];
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                sortKey="Code"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                Código
              </SortableTableHead>
              <SortableTableHead
                sortKey="BusinessName"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                Razón Social
              </SortableTableHead>
              <SortableTableHead
                sortKey="Cuit"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                CUIT
              </SortableTableHead>
              <SortableTableHead
                sortKey="City"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                Ciudad
              </SortableTableHead>
              <SortableTableHead>Tendencia</SortableTableHead>
              <SortableTableHead>Clasificación</SortableTableHead>
              <SortableTableHead>Última Compra</SortableTableHead>
              <SortableTableHead>Estado</SortableTableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No hay clientes registrados
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <ClickableTableRow
                  key={client.id}
                  onRowClick={() => onEdit(client)}
                  aria-label={`Editar cliente ${client.businessName}`}
                >
                  <TableCell className="font-medium">{client.code}</TableCell>
                  <TableCell>{client.businessName}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatCuit(client.cuit) || '-'}
                  </TableCell>
                  <TableCell>{client.city || '-'}</TableCell>
                  <TableCell>
                    {client.salesTrend && client.salesTrend.length > 0 ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          {getTrendIcon(calculateTrend(client.salesTrend))}
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(
                              client.salesTrend.reduce((a, b) => a + b, 0) / client.salesTrend.length
                            )}/mes
                          </span>
                        </div>
                        <SparklineWithTooltip
                          data={client.salesTrend}
                          labels={client.salesTrendLabels}
                          width={Math.min(180, Math.max(80, client.salesTrend.length * 10))}
                          height={30}
                          color={
                            calculateTrend(client.salesTrend) === 'increasing'
                              ? 'rgb(34, 197, 94)' // green
                              : calculateTrend(client.salesTrend) === 'decreasing'
                              ? 'rgb(239, 68, 68)' // red
                              : 'rgb(59, 130, 246)' // blue
                          }
                          fillColor={
                            calculateTrend(client.salesTrend) === 'increasing'
                              ? 'rgba(34, 197, 94, 0.1)'
                              : calculateTrend(client.salesTrend) === 'decreasing'
                              ? 'rgba(239, 68, 68, 0.1)'
                              : 'rgba(59, 130, 246, 0.1)'
                          }
                          formatValue={(v) => formatCurrency(v)}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin datos</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getClientStatusBadge(client.clientStatus)}
                  </TableCell>
                  <TableCell>
                    {client.lastPurchaseDate ? (
                      <div className="space-y-1">
                        <div className="text-sm">
                          {new Date(client.lastPurchaseDate).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </div>
                        {client.daysSinceLastPurchase !== null && (
                          <div className="text-xs text-muted-foreground">
                            Hace {client.daysSinceLastPurchase} día{client.daysSinceLastPurchase !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nunca</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.isActive ? 'default' : 'secondary'}>
                      {client.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant={ACTION_BUTTON_CONFIG.edit.variant}
                        size={ACTION_BUTTON_CONFIG.edit.size}
                        onClick={() => onEdit(client)}
                        title={ACTION_BUTTON_CONFIG.edit.title}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={ACTION_BUTTON_CONFIG.delete.variant}
                        size={ACTION_BUTTON_CONFIG.delete.size}
                        onClick={() => setClientToDelete(client)}
                        title={ACTION_BUTTON_CONFIG.delete.title}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </ClickableTableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!clientToDelete} onOpenChange={() => setClientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el cliente <strong>{clientToDelete?.businessName}</strong>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
