'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Printer, XCircle, Eye, Save, X as XIcon, Edit2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  useInvoice,
  useCancelInvoice,
  usePrintInvoice,
  useUpdateInvoiceExchangeRate,
  useInvoiceStockMovements,
} from '@/lib/hooks/useInvoices';
import { usePaymentTerms } from '@/lib/hooks/usePaymentTerms';
import { useQuickInvoiceTabs } from '@/lib/hooks/useQuickInvoiceTabs';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = Number(params.id);

  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const { data: stockMovements, isLoading: isLoadingMovements } =
    useInvoiceStockMovements(invoiceId);
  const { data: paymentTerms } = usePaymentTerms({ activeOnly: true });
  const queryClient = useQueryClient();
  const cancelInvoiceMutation = useCancelInvoice();
  const printInvoiceMutation = usePrintInvoice();
  const updateExchangeRateMutation = useUpdateInvoiceExchangeRate();
  const { addInvoiceTab } = useQuickInvoiceTabs();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isEditingExchangeRate, setIsEditingExchangeRate] = useState(false);
  const [editedExchangeRate, setEditedExchangeRate] = useState('');
  const [isEditingPaymentTerm, setIsEditingPaymentTerm] = useState(false);
  const [editedPaymentTermId, setEditedPaymentTermId] = useState<number | null>(null);

  // Add invoice to tabs when loaded
  useEffect(() => {
    if (invoice) {
      addInvoiceTab(invoice.id, invoice.invoiceNumber, invoice.clientBusinessName);
      if (invoice.usdExchangeRate) {
        setEditedExchangeRate(invoice.usdExchangeRate.toString());
      }
      if (invoice.paymentTermId) {
        setEditedPaymentTermId(invoice.paymentTermId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]); // Only depend on invoice.id to avoid infinite loop

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Cargando factura...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Factura no encontrada</p>
        <Button onClick={() => router.push(ROUTES.INVOICES)}>
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
      return (
        <Badge variant="default" className="bg-green-600">
          Impresa
        </Badge>
      );
    }
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  const handleCancel = () => {
    cancelInvoiceMutation.mutate(
      { id: invoiceId },
      {
        onSuccess: () => {
          setShowCancelDialog(false);
        },
      }
    );
  };

  const handlePrint = () => {
    printInvoiceMutation.mutate(invoiceId);
  };

  const handleSaveExchangeRate = () => {
    const rate = parseFloat(editedExchangeRate);
    if (isNaN(rate) || rate <= 0) {
      return;
    }

    updateExchangeRateMutation.mutate(
      { id: invoiceId, usdExchangeRate: rate },
      {
        onSuccess: () => {
          setIsEditingExchangeRate(false);
        },
      }
    );
  };

  const handleCancelEditExchangeRate = () => {
    setIsEditingExchangeRate(false);
    if (invoice?.usdExchangeRate) {
      setEditedExchangeRate(invoice.usdExchangeRate.toString());
    }
  };

  const handleSavePaymentTerm = async () => {
    if (!editedPaymentTermId) return;

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/payment-term`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentTermId: editedPaymentTermId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar condición de pago');
      }

      const result = await response.json();

      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });

      // Show success message with details
      toast.success('Condición de pago actualizada', {
        description: `Se recalcularon ${result.itemsRecalculated} item(s) con los nuevos descuentos`,
        duration: 4000,
      });

      setIsEditingPaymentTerm(false);
    } catch (error) {
      console.error('Error updating payment term:', error);
      toast.error('Error al actualizar la condición de pago');
    }
  };

  const handleCancelEditPaymentTerm = () => {
    setIsEditingPaymentTerm(false);
    if (invoice?.paymentTermId) {
      setEditedPaymentTermId(invoice.paymentTermId);
    }
  };

  const formatRelativeDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'hace un momento';
      if (diffInSeconds < 3600) return `hace ${Math.floor(diffInSeconds / 60)} minutos`;
      if (diffInSeconds < 86400) return `hace ${Math.floor(diffInSeconds / 3600)} horas`;
      if (diffInSeconds < 604800) return `hace ${Math.floor(diffInSeconds / 86400)} días`;
      return formatDate(dateString);
    } catch {
      return dateString;
    }
  };

  const getMovementTypeBadge = (movementType: number) => {
    switch (movementType) {
      case 1: // Compra (CREDIT)
        return (
          <Badge variant="default" className="bg-green-600">
            Compra
          </Badge>
        );
      case 2: // Venta (DEBIT)
        return <Badge variant="destructive">Venta</Badge>;
      case 3: // Devolución
        return (
          <Badge variant="secondary" className="bg-blue-600 text-white">
            Devolución
          </Badge>
        );
      case 4: // Ajuste
        return (
          <Badge variant="secondary" className="bg-yellow-600">
            Ajuste
          </Badge>
        );
      case 5: // Transferencia
        return <Badge variant="outline">Transferencia</Badge>;
      default:
        return <Badge variant="secondary">Otro</Badge>;
    }
  };

  const formatQuantity = (quantity: number) => {
    const isPositive = quantity > 0;
    return (
      <span className={isPositive ? 'font-semibold text-green-600' : 'font-semibold text-red-600'}>
        {isPositive ? '+' : ''}
        {quantity}
      </span>
    );
  };

  const canEditExchangeRate = invoice && !invoice.isPrinted && !invoice.isCancelled;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push(ROUTES.INVOICES)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Factura {invoice.invoiceNumber}</h1>
            <p className="text-muted-foreground">Fecha: {formatDate(invoice.invoiceDate)}</p>
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
              <p className="text-muted-foreground text-sm">Razón Social</p>
              <p className="font-medium">{invoice.clientBusinessName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">CUIT</p>
              <p className="font-medium">{invoice.clientCuit}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Condición IVA</p>
              <p className="font-medium">{invoice.clientTaxCondition}</p>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información de la Factura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground text-sm">Pedido N°</p>
              <p className="font-medium">{invoice.salesOrderNumber}</p>
            </div>

            <div>
              <Label htmlFor="exchangeRate" className="text-muted-foreground text-sm">
                Tipo de Cambio USD
              </Label>
              {isEditingExchangeRate ? (
                <div className="mt-2 flex gap-2">
                  <Input
                    id="exchangeRate"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editedExchangeRate}
                    onChange={(e) => setEditedExchangeRate(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveExchangeRate}
                    disabled={updateExchangeRateMutation.isPending}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEditExchangeRate}>
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-medium">
                    {invoice.usdExchangeRate ? `$ ${invoice.usdExchangeRate.toFixed(2)}` : 'N/A'}
                  </p>
                  {canEditExchangeRate && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setIsEditingExchangeRate(true)}
                      title="Editar tipo de cambio"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
              {canEditExchangeRate && !isEditingExchangeRate && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Puede modificar el tipo de cambio mientras la factura no esté impresa. Esto
                  recalculará todos los importes.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="paymentTerm" className="text-muted-foreground text-sm">
                Condición de Pago
              </Label>
              {isEditingPaymentTerm ? (
                <div className="mt-2 flex gap-2">
                  <Select
                    value={editedPaymentTermId?.toString()}
                    onValueChange={(value) => setEditedPaymentTermId(Number(value))}
                  >
                    <SelectTrigger className="max-w-xs">
                      <SelectValue placeholder="Seleccionar condición" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTerms?.map((term) => (
                        <SelectItem key={term.id} value={term.id.toString()}>
                          {term.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleSavePaymentTerm}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEditPaymentTerm}>
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-medium">{invoice.paymentTermName || 'N/A'}</p>
                  {canEditExchangeRate && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setIsEditingPaymentTerm(true)}
                      title="Editar condición de pago"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
              {canEditExchangeRate && !isEditingPaymentTerm && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Puede modificar la condición de pago mientras la factura no esté impresa. Esto
                  recalculará los descuentos de cada item y actualizará la condición del cliente.
                </p>
              )}
            </div>
            {invoice.notes && (
              <div>
                <p className="text-muted-foreground text-sm">Observaciones</p>
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
                  <TableCell className="text-right">
                    {formatCurrency(item.unitPriceArs)}
                    <span className="text-muted-foreground block text-xs">
                      (USD {item.unitPriceUsd.toFixed(2)})
                    </span>
                  </TableCell>
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
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
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
            <p className="text-muted-foreground mt-2 text-sm">
              Cancelada el: {invoice.cancelledAt ? formatDate(invoice.cancelledAt) : 'N/A'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stock Movements Section */}
      {(invoice.isPrinted || invoice.isCancelled) && (
        <Card>
          <CardHeader>
            <CardTitle>Movimientos de Stock</CardTitle>
            <CardDescription>
              {stockMovements && stockMovements.length > 0
                ? `${stockMovements.length} movimiento(s) de inventario asociados a esta factura`
                : 'Movimientos de inventario asociados a esta factura'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMovements ? (
              <div className="py-4 text-center">
                <p className="text-muted-foreground text-sm">Cargando movimientos...</p>
              </div>
            ) : stockMovements && stockMovements.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Artículo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {formatRelativeDate(movement.movementDate)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {formatDate(movement.movementDate)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{movement.articleCode}</p>
                          <p className="text-muted-foreground text-xs">
                            {movement.articleDescription}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getMovementTypeBadge(movement.movementType)}</TableCell>
                      <TableCell className="text-right">
                        {formatQuantity(movement.quantity)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{movement.referenceDocument || '-'}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-4 text-center">
                <p className="text-muted-foreground text-sm">
                  No hay movimientos de stock registrados para esta factura
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fixed Action Buttons */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed right-0 bottom-0 left-0 z-50 border-t backdrop-blur">
        <div className="container mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push(ROUTES.INVOICES)}>
                Volver
              </Button>
              {!invoice.isCancelled && (
                <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar Factura
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`${ROUTES.SALES_ORDERS}/${invoice.salesOrderId}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver Pedido
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(`/api/invoices/${invoice.id}/preview-pdf`, '_blank')}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver PDF
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
              Esta acción marcará la factura como CANCELADA.
              {invoice?.isPrinted && (
                <> Como la factura está impresa, se restaurará el stock automáticamente.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelInvoiceMutation.isPending}>
              {cancelInvoiceMutation.isPending ? 'Cancelando...' : 'Sí, cancelar factura'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
