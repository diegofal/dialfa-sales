'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, XCircle, Eye, Save, X as XIcon, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useInvoice, useCancelInvoice, usePrintInvoice, useUpdateInvoiceExchangeRate, useInvoiceStockMovements, useDeleteInvoice, useUpdateInvoiceItems } from '@/lib/hooks/useInvoices';
import { useQuickInvoiceTabs } from '@/lib/hooks/useQuickInvoiceTabs';
import { useState, useEffect, useCallback, useRef } from 'react';
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
import { formatCuit } from '@/lib/utils';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = Number(params.id);

  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const { data: stockMovements, isLoading: isLoadingMovements } = useInvoiceStockMovements(invoiceId);
  const cancelInvoiceMutation = useCancelInvoice();
  const deleteInvoiceMutation = useDeleteInvoice();
  const printInvoiceMutation = usePrintInvoice();
  const updateExchangeRateMutation = useUpdateInvoiceExchangeRate();
  const updateInvoiceItemsMutation = useUpdateInvoiceItems();
  const { addInvoiceTab } = useQuickInvoiceTabs();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isEditingExchangeRate, setIsEditingExchangeRate] = useState(false);
  const [editedExchangeRate, setEditedExchangeRate] = useState('');
  const [editedItems, setEditedItems] = useState<Array<{id: number, discountPercent: number}>>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Función para guardar items (debe estar antes de los returns condicionales)
  const handleSaveItems = useCallback(() => {
    if (!invoice) return;
    
    // Comparar con valores originales - solo guardar si hay cambios REALES
    const hasRealChanges = editedItems.some(editedItem => {
      const originalItem = invoice.items.find(i => i.id === editedItem.id);
      return originalItem && originalItem.discountPercent !== editedItem.discountPercent;
    });

    if (!hasRealChanges || editedItems.length === 0) {
      return;
    }

    // Enviar TODOS los items con sus descuentos actuales (mezclando editados y originales)
    const allItemsWithDiscounts = invoice.items.map(item => {
      const editedItem = editedItems.find(e => e.id === item.id);
      return {
        id: item.id,
        discountPercent: editedItem ? editedItem.discountPercent : item.discountPercent,
      };
    });

    updateInvoiceItemsMutation.mutate(
      { id: invoiceId, items: allItemsWithDiscounts },
      {
        onSuccess: () => {
          // Limpiar items editados después de guardar
          setEditedItems([]);
        },
      }
    );
  }, [editedItems, invoiceId, invoice, updateInvoiceItemsMutation]);

  // Debounce para guardar automáticamente después de 1 segundo
  useEffect(() => {
    if (editedItems.length === 0) return;

    // Limpiar el timeout anterior
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Crear nuevo timeout
    saveTimeoutRef.current = setTimeout(() => {
      handleSaveItems();
    }, 1000); // 1 segundo de delay

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editedItems, handleSaveItems]);

  // Add invoice to tabs when loaded
  useEffect(() => {
    if (invoice) {
      addInvoiceTab(invoice.id, invoice.invoiceNumber, invoice.clientBusinessName);
      if (invoice.usdExchangeRate) {
        setEditedExchangeRate(invoice.usdExchangeRate.toString());
      }
      // Cargar descuentos editables
      setEditedItems(invoice.items.map(item => ({
        id: item.id,
        discountPercent: item.discountPercent
      })));
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
    cancelInvoiceMutation.mutate(
      { id: invoiceId },
      {
        onSuccess: () => {
          setShowCancelDialog(false);
        },
      }
    );
  };

  const handleDelete = () => {
    deleteInvoiceMutation.mutate(invoiceId, {
      onSuccess: () => {
        setShowCancelDialog(false);
        router.push('/dashboard/invoices');
      },
    });
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
        return <Badge variant="default" className="bg-green-600">Compra</Badge>;
      case 2: // Venta (DEBIT)
        return <Badge variant="destructive">Venta</Badge>;
      case 3: // Devolución
        return <Badge variant="secondary" className="bg-blue-600 text-white">Devolución</Badge>;
      case 4: // Ajuste
        return <Badge variant="secondary" className="bg-yellow-600">Ajuste</Badge>;
      case 5: // Transferencia
        return <Badge variant="outline">Transferencia</Badge>;
      default:
        return <Badge variant="secondary">Otro</Badge>;
    }
  };

  const formatQuantity = (quantity: number) => {
    const isPositive = quantity > 0;
    return (
      <span className={isPositive ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
        {isPositive ? '+' : ''}{quantity}
      </span>
    );
  };

  const canEditExchangeRate = invoice && !invoice.isPrinted && !invoice.isCancelled;

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
              <p className="font-medium font-mono">{formatCuit(invoice.clientCuit)}</p>
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
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Pedido N°</p>
              <p className="font-medium">{invoice.salesOrderNumber}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Condición de Pago</p>
              <p className="font-medium">
                {invoice.paymentTermName ? (
                  <Badge variant="outline" className="text-base font-medium">
                    {invoice.paymentTermName}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">No especificada</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Define los descuentos aplicables por categoría
              </p>
            </div>

            <div>
              <Label htmlFor="exchangeRate" className="text-sm text-muted-foreground">
                Tipo de Cambio USD
              </Label>
              {isEditingExchangeRate ? (
                <div className="flex gap-2 mt-2">
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEditExchangeRate}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
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
                <p className="text-xs text-muted-foreground mt-1">
                  Puede modificar el tipo de cambio mientras la factura no esté impresa.
                  Esto recalculará todos los importes.
                </p>
              )}
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
                  <TableCell className="text-right">
                    {formatCurrency(item.unitPriceArs)}
                    <span className="text-xs text-muted-foreground block">
                      (USD {item.unitPriceUsd.toFixed(2)})
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {canEditExchangeRate ? (
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={editedItems.find(i => i.id === item.id)?.discountPercent ?? item.discountPercent}
                          onChange={(e) => {
                            const newDiscount = parseFloat(e.target.value) || 0;
                            setEditedItems(items => {
                              const existingIndex = items.findIndex(i => i.id === item.id);
                              if (existingIndex >= 0) {
                                return items.map(i => 
                                  i.id === item.id ? { ...i, discountPercent: newDiscount } : i
                                );
                              } else {
                                return [...items, { id: item.id, discountPercent: newDiscount }];
                              }
                            });
                          }}
                          className="w-16 h-8 text-right text-sm"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    ) : (
                      `${item.discountPercent}%`
                    )}
                  </TableCell>
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
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Cargando movimientos...</p>
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
                          <span className="text-xs text-muted-foreground">
                            {formatDate(movement.movementDate)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{movement.articleCode}</p>
                          <p className="text-xs text-muted-foreground">
                            {movement.articleDescription}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getMovementTypeBadge(movement.movementType)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQuantity(movement.quantity)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {movement.referenceDocument || '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  No hay movimientos de stock registrados para esta factura
                </p>
              </div>
            )}
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
              {!invoice.isCancelled && (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  className={!invoice.isPrinted ? "text-destructive hover:text-destructive" : ""}
                >
                  {invoice.isPrinted ? (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancelar Factura
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar Factura
                    </>
                  )}
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

      {/* Cancel/Delete Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {invoice.isPrinted ? '¿Cancelar factura?' : '¿Eliminar factura?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {invoice.isPrinted ? (
                <>
                  Esta acción marcará la factura como CANCELADA y se restaurará el stock automáticamente.
                </>
              ) : (
                <>
                  Esta acción eliminará la factura permanentemente. Como la factura no ha sido impresa, no hay cambios en el stock que revertir.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              No, volver
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={invoice.isPrinted ? handleCancel : handleDelete}
              disabled={cancelInvoiceMutation.isPending || deleteInvoiceMutation.isPending}
              className={!invoice.isPrinted ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {invoice.isPrinted ? (
                cancelInvoiceMutation.isPending ? 'Cancelando...' : 'Sí, cancelar factura'
              ) : (
                deleteInvoiceMutation.isPending ? 'Eliminando...' : 'Sí, eliminar factura'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}


