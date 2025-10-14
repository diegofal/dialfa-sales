'use client';

import { useState } from 'react';
import { Trash2, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
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
import { Badge } from '@/components/ui/badge';
import type { SalesOrderListDto } from '@/types/salesOrder';

interface SalesOrdersTableProps {
  orders: SalesOrderListDto[];
  onViewOrder: (id: number) => void;
  onCancelOrder: (id: number) => void;
  onDeleteOrder: (id: number) => void;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
}

export function SalesOrdersTable({
  orders,
  onViewOrder,
  onCancelOrder,
  onDeleteOrder,
  currentSortBy,
  currentSortDescending,
  onSort,
}: SalesOrdersTableProps) {
  const [orderToCancel, setOrderToCancel] = useState<number | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'INVOICED':
        return <Badge variant="default">Facturado</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR');
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead sortKey="OrderNumber" currentSortBy={currentSortBy} currentSortDescending={currentSortDescending} onSort={onSort}>
                N° Pedido
              </SortableTableHead>
              <SortableTableHead sortKey="OrderDate" currentSortBy={currentSortBy} currentSortDescending={currentSortDescending} onSort={onSort}>
                Fecha
              </SortableTableHead>
              <SortableTableHead sortKey="ClientBusinessName" currentSortBy={currentSortBy} currentSortDescending={currentSortDescending} onSort={onSort}>
                Cliente
              </SortableTableHead>
              <SortableTableHead sortKey="Status" currentSortBy={currentSortBy} currentSortDescending={currentSortDescending} onSort={onSort}>
                Estado
              </SortableTableHead>
              <SortableTableHead sortKey="ItemsCount" currentSortBy={currentSortBy} currentSortDescending={currentSortDescending} onSort={onSort} align="right">
                Items
              </SortableTableHead>
              <SortableTableHead sortKey="Total" currentSortBy={currentSortBy} currentSortDescending={currentSortDescending} onSort={onSort} align="right">
                Total
              </SortableTableHead>
              <SortableTableHead align="right">Acciones</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No se encontraron pedidos
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{formatDate(order.orderDate)}</TableCell>
                  <TableCell>{order.clientBusinessName}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-right">{order.itemsCount}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onViewOrder(order.id)}
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {order.status === 'PENDING' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setOrderToCancel(order.id)}
                            title="Cancelar pedido"
                          >
                            <XCircle className="h-4 w-4 text-orange-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setOrderToDelete(order.id)}
                            title="Eliminar pedido"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!orderToCancel} onOpenChange={() => setOrderToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cambiará el estado del pedido a CANCELADO. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (orderToCancel) {
                  onCancelOrder(orderToCancel);
                  setOrderToCancel(null);
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el pedido. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (orderToDelete) {
                  onDeleteOrder(orderToDelete);
                  setOrderToDelete(null);
                }
              }}
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

