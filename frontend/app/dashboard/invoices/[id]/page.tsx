'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, XCircle, Edit, Eye } from 'lucide-react';
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
import { useInvoice, useCancelInvoice, usePrintInvoice } from '@/lib/hooks/useInvoices';
import { useQuickInvoiceTabs } from '@/lib/hooks/useQuickInvoiceTabs';
import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = Number(params.id);
  
  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const cancelInvoiceMutation = useCancelInvoice();
  const printInvoiceMutation = usePrintInvoice();
  const { addInvoiceTab } = useQuickInvoiceTabs();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  // Add invoice to tabs when loaded
  useEffect(() => {
    if (invoice) {
      addInvoiceTab(invoice.id, invoice.invoiceNumber, invoice.clientBusinessName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]); // Only depend on invoice.id to avoid infinite loop

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Cargando factura...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Factura no encontrada</p>
        <Button onClick={() => router.push('/dashboard/invoices')}>
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
    if (invoice.isCancelled) {
      return <Badge variant="destructive">Cancelada</Badge>;
    }
    if (invoice.isPrinted) {
      return <Badge variant="default" className="bg-green-600">Impresa</Badge>;
    }
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  const handleCancel = () => {
    if (cancellationReason.trim()) {
      cancelInvoiceMutation.mutate(
        { id: invoiceId, data: { cancellationReason } },
        {
          onSuccess: () => {
            setShowCancelDialog(false);
            setCancellationReason('');
          },
        }
      );
    }
  };

  const handlePrint = () => {
    printInvoiceMutation.mutate(invoiceId);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard/invoices')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Factura {invoice.invoiceNumber}</h1>
            <p className="text-muted-foreground">
              Fecha: {formatDate(invoice.invoiceDate)}
            </p>
          </div>
          {getStatusBadge()}
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
              <p className="font-medium">{invoice.clientBusinessName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CUIT</p>
              <p className="font-medium">{invoice.clientCuit}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Condición IVA</p>
              <p className="font-medium">{invoice.clientTaxCondition}</p>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información de la Factura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Pedido N°</p>
              <p className="font-medium">{invoice.salesOrderNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo de Cambio USD</p>
              <p className="font-medium">
                {invoice.usdExchangeRate ? `$ ${invoice.usdExchangeRate.toFixed(2)}` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Descuento Especial</p>
              <p className="font-medium">{invoice.specialDiscountPercent}%</p>
            </div>
            {invoice.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Observaciones</p>
                <p className="font-medium">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>{invoice.items.length} artículo(s)</CardDescription>
        </CardHeader>
        <CardContent>
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
              {invoice.items.map((item) => (
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
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(invoice.netAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA</span>
              <span className="font-medium">{formatCurrency(invoice.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total</span>
              <span>{formatCurrency(invoice.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.isCancelled && invoice.cancellationReason && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Factura Cancelada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-medium">Motivo: </span>
              {invoice.cancellationReason}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Cancelada el: {invoice.cancelledAt ? formatDate(invoice.cancelledAt) : 'N/A'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Fixed Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t z-50">
        <div className="container max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard/invoices')}
              >
                Volver
              </Button>
              {!invoice.isCancelled && !invoice.isPrinted && (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar Factura
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/sales-orders/${invoice.salesOrderId}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver Pedido
              </Button>
              {!invoice.isCancelled && !invoice.isPrinted && (
                <Button onClick={handlePrint} disabled={printInvoiceMutation.isPending}>
                  <Printer className="mr-2 h-4 w-4" />
                  {printInvoiceMutation.isPending ? 'Imprimiendo...' : 'Imprimir'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará la factura como CANCELADA. Debe proporcionar un motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Motivo de cancelación
            </label>
            <Input
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Ingrese el motivo de la cancelación"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancellationReason('')}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={!cancellationReason.trim() || cancelInvoiceMutation.isPending}
            >
              {cancelInvoiceMutation.isPending ? 'Cancelando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


