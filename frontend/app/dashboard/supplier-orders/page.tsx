'use client';

import axios from 'axios';
import {
  Plus,
  Package,
  Trash2,
  Upload,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useSupplierOrders, useDeleteSupplierOrder } from '@/lib/hooks/domain/useSupplierOrders';
import { ImportResult } from '@/lib/utils/priceLists/proformaImport/types';
import { useAuthStore } from '@/store/authStore';
import { SupplierOrder, SupplierOrderStatus } from '@/types/supplierOrder';

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

type SortKey =
  | 'proformaNumber'
  | 'orderNumber'
  | 'supplierName'
  | 'orderDate'
  | 'totalItems'
  | 'totalQuantity'
  | 'totalProforma'
  | 'totalCIF'
  | 'totalDB'
  | 'totalMargin'
  | 'estimatedSaleTimeMonths';

interface ComputedOrder {
  order: SupplierOrder;
  totalProforma: number;
  totalCIF: number;
  totalDB: number;
  totalMargin: number;
  marginPercent: number;
  cifPct: number;
}

function SortableHead({
  label,
  sortKey,
  currentSort,
  currentDirection,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey | null;
  currentDirection: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSort === sortKey;
  return (
    <TableHead
      className={`cursor-pointer select-none ${className || ''}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          currentDirection === 'desc' ? (
            <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUp className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}

export default function SupplierOrdersPage() {
  const router = useRouter();
  const { isAdmin } = useAuthStore();
  const canEdit = isAdmin();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [showImportZone, setShowImportZone] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [sortColumn, setSortColumn] = useState<SortKey | null>('orderDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [syncing, setSyncing] = useState(false);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState('');

  const { data, isLoading, refetch } = useSupplierOrders({
    status: statusFilter !== 'all' ? (statusFilter as SupplierOrderStatus) : undefined,
  });

  const deleteOrderMutation = useDeleteSupplierOrder();

  const orders = data?.data || [];

  // Pre-compute derived values and sort
  const sortedOrders = useMemo((): ComputedOrder[] => {
    const computed = orders.map((order) => {
      const cifPct = order.cifPercentage ?? 50;
      const totalProforma =
        order.items?.reduce((sum, item) => sum + (item.proformaTotalPrice || 0), 0) || 0;
      const totalCIF = totalProforma * (1 + cifPct / 100);
      const totalDB =
        order.items?.reduce((sum, item) => {
          const discount = item.discountPercent || 0;
          const discountedPrice = (item.dbUnitPrice || 0) * (1 - discount / 100);
          return sum + discountedPrice * item.quantity;
        }, 0) || 0;
      const totalMargin = totalDB - totalCIF;
      const marginPercent = totalCIF > 0 ? (totalMargin / totalCIF) * 100 : 0;

      return { order, totalProforma, totalCIF, totalDB, totalMargin, marginPercent, cifPct };
    });

    if (!sortColumn) return computed;

    return [...computed].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortColumn) {
        case 'proformaNumber':
          aVal = a.order.proformaNumber || '';
          bVal = b.order.proformaNumber || '';
          break;
        case 'orderNumber':
          aVal = a.order.orderNumber;
          bVal = b.order.orderNumber;
          break;
        case 'supplierName':
          aVal = a.order.supplierName || '';
          bVal = b.order.supplierName || '';
          break;
        case 'orderDate':
          aVal = new Date(a.order.orderDate).getTime();
          bVal = new Date(b.order.orderDate).getTime();
          break;
        case 'totalItems':
          aVal = a.order.totalItems;
          bVal = b.order.totalItems;
          break;
        case 'totalQuantity':
          aVal = a.order.totalQuantity;
          bVal = b.order.totalQuantity;
          break;
        case 'totalProforma':
          aVal = a.totalProforma;
          bVal = b.totalProforma;
          break;
        case 'totalCIF':
          aVal = a.totalCIF;
          bVal = b.totalCIF;
          break;
        case 'totalDB':
          aVal = a.totalDB;
          bVal = b.totalDB;
          break;
        case 'totalMargin':
          aVal = a.totalMargin;
          bVal = b.totalMargin;
          break;
        case 'estimatedSaleTimeMonths':
          aVal = a.order.estimatedSaleTimeMonths || Infinity;
          bVal = b.order.estimatedSaleTimeMonths || Infinity;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [orders, sortColumn, sortDirection]);

  // Aggregate totals
  const totals = useMemo(() => {
    return sortedOrders.reduce(
      (acc, { totalProforma, totalCIF, totalDB, totalMargin }) => ({
        totalProforma: acc.totalProforma + totalProforma,
        totalCIF: acc.totalCIF + totalCIF,
        totalDB: acc.totalDB + totalDB,
        totalMargin: acc.totalMargin + totalMargin,
      }),
      { totalProforma: 0, totalCIF: 0, totalDB: 0, totalMargin: 0 }
    );
  }, [sortedOrders]);

  const totalMarginPercent = totals.totalCIF > 0 ? (totals.totalMargin / totals.totalCIF) * 100 : 0;

  const handleSort = (key: SortKey) => {
    if (sortColumn === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(key);
      setSortDirection('desc');
    }
  };

  const handleNewOrder = () => {
    router.push(`${ROUTES.ARTICLES}?tab=articles`);
  };

  const handleDelete = async () => {
    if (orderToDelete) {
      await deleteOrderMutation.mutateAsync(orderToDelete);
      setOrderToDelete(null);
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    let count = 0;
    for (const order of orders) {
      try {
        await deleteOrderMutation.mutateAsync(order.id);
        count++;
      } catch {
        // continue
      }
    }
    setDeletingAll(false);
    setShowDeleteAll(false);
    toast.success(`${count} pedidos eliminados`);
    refetch();
  };

  const handleImportSuccess = (result: ImportResult) => {
    setImportResult(result);
    setShowImportZone(false);
  };

  const handleImportDialogClose = () => {
    setImportResult(null);
  };

  const handleSyncAll = async () => {
    if (
      !confirm(
        `¿Sincronizar datos de ${orders.length} pedidos a los artículos?\n\nEsto actualizará peso (kg), último precio de compra y % CIF de cada artículo con los datos de sus proformas.`
      )
    ) {
      return;
    }

    setSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const order of orders) {
      const cifPct = order.cifPercentage ?? 50;
      try {
        await axios.post(`/api/supplier-orders/${order.id}/sync-data`, {
          cifPercentage: cifPct,
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setSyncing(false);
    toast.success(
      `${successCount} pedidos sincronizados${errorCount > 0 ? `, ${errorCount} errores` : ''}`
    );
  };

  const handleApplyGlobalDiscount = async () => {
    const discount = parseFloat(globalDiscount);
    if (isNaN(discount) || discount < 0 || discount > 100) return;

    setApplyingDiscount(true);
    let successCount = 0;

    for (const order of orders) {
      if (!order.items || order.items.length === 0) continue;

      const items = order.items.map((item) => ({
        articleId: item.articleId,
        discountPercent: discount,
      }));

      try {
        await axios.put(`/api/supplier-orders/${order.id}/discounts`, {
          useCategoryDiscounts: false,
          items,
        });
        successCount++;
      } catch {
        // continue
      }
    }

    setApplyingDiscount(false);
    setGlobalDiscount('');
    toast.success(`Descuento ${discount}% aplicado a ${successCount} pedidos`);
    refetch();
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
            <Button
              variant="outline"
              onClick={handleSyncAll}
              disabled={syncing || orders.length === 0}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Datos'}
            </Button>
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

      {/* Commercial Analysis Panel */}
      {orders.length > 0 && (
        <Card className="space-y-4 p-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
              <div className="text-xl font-bold text-blue-700 dark:text-blue-400">
                ${totals.totalProforma.toFixed(2)}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-500">Total Proforma (FOB)</div>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950">
              <div className="text-xl font-bold text-orange-700 dark:text-orange-400">
                ${totals.totalCIF.toFixed(2)}
              </div>
              <div className="text-xs text-orange-600 dark:text-orange-500">Total CIF (50%)</div>
            </div>
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-900 dark:bg-cyan-950">
              <div className="text-xl font-bold text-cyan-700 dark:text-cyan-400">
                ${totals.totalDB.toFixed(2)}
              </div>
              <div className="text-xs text-cyan-600 dark:text-cyan-500">Total DB (c/desc.)</div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
              <div
                className={`text-xl font-bold ${totalMarginPercent >= 100 ? 'text-emerald-700 dark:text-emerald-400' : totalMarginPercent >= 50 ? 'text-yellow-600' : 'text-red-600'}`}
              >
                ${totals.totalMargin.toFixed(2)} ({totalMarginPercent.toFixed(1)}%)
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-500">Margen Real</div>
            </div>
          </div>

          {/* Batch Discount + Delete All */}
          {canEdit && (
            <div className="flex items-end gap-4 border-t pt-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                  Aplicar descuento global a todos los pedidos
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="Ej: 25"
                    value={globalDiscount}
                    onChange={(e) => setGlobalDiscount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyGlobalDiscount();
                    }}
                    className="h-8 w-24 text-right"
                  />
                  <span className="text-muted-foreground text-sm">%</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleApplyGlobalDiscount}
                    disabled={
                      applyingDiscount || !globalDiscount || isNaN(parseFloat(globalDiscount))
                    }
                    className="h-8"
                  >
                    {applyingDiscount ? 'Aplicando...' : 'Aplicar a todos'}
                  </Button>
                </div>
              </div>
              <div className="ml-auto">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteAll(true)}
                  disabled={orders.length === 0}
                  className="h-8"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Eliminar todos ({orders.length})
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

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
                <SortableHead
                  label="N° Proforma"
                  sortKey="proformaNumber"
                  currentSort={sortColumn}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHead
                  label="N° Pedido"
                  sortKey="orderNumber"
                  currentSort={sortColumn}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHead
                  label="Proveedor"
                  sortKey="supplierName"
                  currentSort={sortColumn}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHead
                  label="Fecha"
                  sortKey="orderDate"
                  currentSort={sortColumn}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableHead
                  label="Artículos"
                  sortKey="totalItems"
                  currentSort={sortColumn}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableHead
                  label="Cantidad"
                  sortKey="totalQuantity"
                  currentSort={sortColumn}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableHead
                  label="FOB"
                  sortKey="totalProforma"
                  currentSort={sortColumn}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableHead
                  label="CIF"
                  sortKey="totalCIF"
                  currentSort={sortColumn}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableHead
                  label="DB (c/desc.)"
                  sortKey="totalDB"
                  currentSort={sortColumn}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableHead
                  label="Margen"
                  sortKey="totalMargin"
                  currentSort={sortColumn}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <SortableHead
                  label="T. Est. Venta"
                  sortKey="estimatedSaleTimeMonths"
                  currentSort={sortColumn}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <TableHead>Estado</TableHead>
                {canEdit && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOrders.map(
                ({ order, totalProforma, totalCIF, totalDB, totalMargin, marginPercent }) => {
                  const handleRowClick = () => router.push(`${ROUTES.SUPPLIER_ORDERS}/${order.id}`);

                  return (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell
                        className="cursor-pointer font-mono text-sm"
                        onClick={handleRowClick}
                      >
                        {order.proformaNumber || '-'}
                      </TableCell>
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
                        className="cursor-pointer text-right font-medium text-orange-600"
                        onClick={handleRowClick}
                      >
                        {totalCIF > 0 ? `$${totalCIF.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell
                        className="cursor-pointer text-right font-medium text-cyan-600"
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
                          ? `~${order.estimatedSaleTimeMonths.toFixed(1)}m`
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
                }
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Delete Single Order Dialog */}
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

      {/* Delete All Orders Dialog */}
      <AlertDialog open={showDeleteAll} onOpenChange={setShowDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar TODOS los pedidos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán {orders.length} pedidos con todos sus items. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAll ? 'Eliminando...' : `Eliminar ${orders.length} pedidos`}
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
