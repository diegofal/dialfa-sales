'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, XCircle, Edit, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSalesOrder, useCancelSalesOrder, useDeleteSalesOrder } from '@/lib/hooks/useSalesOrders';
import { useState } from 'react';
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

export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);
  
  const { data: order, isLoading } = useSalesOrder(orderId);
  const cancelOrderMutation = useCancelSalesOrder();
  const deleteOrderMutation = useDeleteSalesOrder();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Cargando pedido...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Pedido no encontrado</p>
        <Button onClick={() => router.push('/dashboard/sales-orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al listado
        </Button>
      </div>
    );
  }

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

  const getStatusBadge = () => {
    switch (order.status) {
      case 'PENDING':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'INVOICED':
        return <Badge variant="default" className="bg-green-600">Facturado</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'COMPLETED':
        return <Badge variant="default" className="bg-blue-600">Completado</Badge>;
      default:
        return <Badge variant="outline">{order.status}</Badge>;
    }
  };

  const handleCancel = () => {
    cancelOrderMutation.mutate(orderId, {
      onSuccess: () => {
        setShowCancelDialog(false);
      },
    });
  };

  const handleDelete = () => {
    deleteOrderMutation.mutate(orderId, {
      onSuccess: () => {
        router.push('/dashboard/sales-orders');
      },
    });
  };

  const canEdit = order.status === 'PENDING';
  const canCancel = order.status === 'PENDING';
  const canDelete = order.status === 'PENDING';
  const canCreateInvoice = order.status === 'PENDING';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard/sales-orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Pedido {order.orderNumber}</h1>
            <p className="text-muted-foreground">
              Fecha: {formatDate(order.orderDate)}
            </p>
          </div>
          {getStatusBadge()}
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => router.push(`/dashboard/sales-orders/${orderId}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
            >
              Eliminar
            </Button>
          )}
          {canCreateInvoice && (
            <Button onClick={() => router.push(`/dashboard/invoices/new?orderId=${orderId}`)}>
              <FileText className="mr-2 h-4 w-4" />
              Crear Factura
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Client Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Razón Social</p>
              <p className="font-medium">{order.clientBusinessName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cliente ID</p>
              <p className="font-medium">
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => router.push(`/dashboard/clients/${order.clientId}`)}
                >
                  {order.clientId}
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Order Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.deliveryDate && (
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Entrega</p>
                <p className="font-medium">{formatDate(order.deliveryDate)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Descuento Especial</p>
              <p className="font-medium">{order.specialDiscountPercent ?? 0}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Items</p>
              <p className="font-medium">{order.itemsCount ?? order.items?.length ?? 0}</p>
            </div>
            {order.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Observaciones</p>
                <p className="font-medium">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>{order.items?.length || 0} artículo(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {order.items && order.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unit.</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.articleCode}</TableCell>
                    <TableCell>{item.articleDescription}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{item.discountPercent}%</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-4">No hay items en este pedido</p>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Totales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal (sin descuento especial)</span>
              <span className="font-medium">
                {formatCurrency(order.total / (1 - (order.specialDiscountPercent ?? 0) / 100))}
              </span>
            </div>
            {(order.specialDiscountPercent ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Descuento Especial ({order.specialDiscountPercent}%)</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(order.total / (1 - (order.specialDiscountPercent ?? 0) / 100) - order.total)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará el pedido como CANCELADO. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelOrderMutation.isPending}
            >
              {cancelOrderMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el pedido permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteOrderMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteOrderMutation.isPending ? 'Eliminando...' : 'Confirmar Eliminación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

