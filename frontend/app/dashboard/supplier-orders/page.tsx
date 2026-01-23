'use client';

import { Plus, Package, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ImportPreviewDialog } from '@/components/supplierOrders/ImportPreviewDialog';
import { ProformaDropZone } from '@/components/supplierOrders/ProformaDropZone';
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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/lib/constants/routes';
import { useSupplierOrders, useDeleteSupplierOrder } from '@/lib/hooks/useSupplierOrders';
import { ImportResult } from '@/lib/services/proformaImport/types';
import { useAuthStore } from '@/store/authStore';
import { SupplierOrderStatus } from '@/types/supplierOrder';

const STATUS_LABELS: Record<SupplierOrderStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  sent: 'Enviado',
  in_transit: 'En Tránsito',
  received: 'Recibido',
  cancelled: 'Cancelado',
};

const STATUS_VARIANTS: Record<
  SupplierOrderStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  draft: 'outline',
  confirmed: 'default',
  sent: 'secondary',
  in_transit: 'secondary',
  received: 'default',
  cancelled: 'destructive',
};

export default function SupplierOrdersPage() {
  const router = useRouter();
  const { isAdmin } = useAuthStore();
  const canEdit = isAdmin();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
  const [showImportZone, setShowImportZone] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const { data, isLoading } = useSupplierOrders({
    status: statusFilter !== 'all' ? (statusFilter as SupplierOrderStatus) : undefined,
  });

  const deleteOrderMutation = useDeleteSupplierOrder();

  const orders = data?.data || [];

  const handleNewOrder = () => {
    router.push(`${ROUTES.ARTICLES}?tab=articles`);
  };

  const handleDelete = async () => {
    if (orderToDelete) {
      await deleteOrderMutation.mutateAsync(orderToDelete);
      setOrderToDelete(null);
    }
  };

  const handleImportSuccess = (result: ImportResult) => {
    setImportResult(result);
    setShowImportZone(false);
  };

  const handleImportDialogClose = () => {
    setImportResult(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pedidos a Proveedores</h1>
          <p className="text-muted-foreground">Gestión de pedidos y compras</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button onClick={() => setShowImportZone(!showImportZone)} variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Importar Proforma
            </Button>
            <Button onClick={handleNewOrder}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Pedido
            </Button>
          </div>
        )}
      </div>

      {/* Import Zone */}
      {canEdit && showImportZone && <ProformaDropZone onImportSuccess={handleImportSuccess} />}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="w-[200px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="in_transit">En Tránsito</SelectItem>
              <SelectItem value="received">Recibido</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="text-muted-foreground p-8 text-center">Cargando pedidos...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p className="text-muted-foreground">No hay pedidos registrados</p>
            {canEdit && (
              <Button className="mt-4" onClick={handleNewOrder}>
                Crear primer pedido
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Pedido</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Artículos</TableHead>
                <TableHead className="text-right">Cantidad Total</TableHead>
                <TableHead className="text-right">Total Proforma</TableHead>
                <TableHead className="text-right">Total DB</TableHead>
                <TableHead className="text-right">Margen Total</TableHead>
                <TableHead className="text-right">Tiempo Est. Venta</TableHead>
                <TableHead>Estado</TableHead>
                {canEdit && <TableHead className="w-[100px]">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const handleRowClick = () => router.push(`${ROUTES.SUPPLIER_ORDERS}/${order.id}`);

                // Calcular totales de valorización
                const totalProforma =
                  order.items?.reduce((sum, item) => sum + (item.proformaTotalPrice || 0), 0) || 0;
                const totalDB =
                  order.items?.reduce((sum, item) => sum + (item.dbTotalPrice || 0), 0) || 0;
                const totalMargin = totalDB - totalProforma;
                const marginPercent = totalProforma > 0 ? (totalDB / totalProforma - 1) * 100 : 0;

                return (
                  <TableRow key={order.id} className="hover:bg-muted/50">
                    <TableCell
                      className="cursor-pointer font-mono font-medium"
                      onClick={handleRowClick}
                    >
                      {order.orderNumber}
                    </TableCell>
                    <TableCell onClick={handleRowClick} className="cursor-pointer">
                      {order.supplierName || 'Sin asignar'}
                    </TableCell>
                    <TableCell onClick={handleRowClick} className="cursor-pointer">
                      {new Date(order.orderDate).toLocaleDateString('es-AR')}
                    </TableCell>
                    <TableCell className="cursor-pointer text-right" onClick={handleRowClick}>
                      {order.totalItems}
                    </TableCell>
                    <TableCell className="cursor-pointer text-right" onClick={handleRowClick}>
                      {order.totalQuantity}
                    </TableCell>
                    <TableCell
                      className="cursor-pointer text-right font-medium"
                      onClick={handleRowClick}
                    >
                      {totalProforma > 0 ? `$${totalProforma.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell
                      className="cursor-pointer text-right font-medium"
                      onClick={handleRowClick}
                    >
                      {totalDB > 0 ? `$${totalDB.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell
                      className={`cursor-pointer text-right font-semibold ${
                        totalMargin > 0 ? 'text-green-600' : totalMargin < 0 ? 'text-red-600' : ''
                      }`}
                      onClick={handleRowClick}
                    >
                      {totalProforma > 0 ? (
                        <>
                          ${totalMargin.toFixed(2)} ({marginPercent.toFixed(1)}%)
                        </>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="cursor-pointer text-right" onClick={handleRowClick}>
                      {order.estimatedSaleTimeMonths
                        ? `~${order.estimatedSaleTimeMonths.toFixed(1)} meses`
                        : '-'}
                    </TableCell>
                    <TableCell onClick={handleRowClick} className="cursor-pointer">
                      <Badge variant={STATUS_VARIANTS[order.status as SupplierOrderStatus]}>
                        {STATUS_LABELS[order.status as SupplierOrderStatus]}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderToDelete(order.id);
                          }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                          aria-label="Eliminar pedido"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El pedido será eliminado permanentemente junto con
              todos sus items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Preview Dialog */}
      <ImportPreviewDialog
        open={!!importResult}
        onOpenChange={handleImportDialogClose}
        importResult={importResult}
      />
    </div>
  );
}
