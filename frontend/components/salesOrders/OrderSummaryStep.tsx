'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useClients } from '@/lib/hooks/useClients';
import type { SalesOrderFormData, SalesOrderItemFormData } from '@/types/salesOrder';

interface OrderSummaryStepProps {
  formData: SalesOrderFormData;
}

export function OrderSummaryStep({ formData }: OrderSummaryStepProps) {
  const { data: clients = [] } = useClients(true);
  const selectedClient = clients.find((c) => c.id === formData.clientId);

  const calculateLineTotal = (item: SalesOrderItemFormData) => {
    const subtotal = item.quantity * item.unitPrice;
    const discount = subtotal * (item.discountPercent / 100);
    return subtotal - discount;
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const calculateTotalDiscount = () => {
    return formData.items.reduce((sum, item) => {
      const subtotal = item.quantity * item.unitPrice;
      return sum + subtotal * (item.discountPercent / 100);
    }, 0);
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Client Info */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Razón Social</p>
              <p className="font-medium">{selectedClient?.businessName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CUIT</p>
              <p className="font-medium">{selectedClient?.cuit}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Domicilio</p>
              <p className="font-medium">{selectedClient?.address}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Localidad</p>
              <p className="font-medium">
                {selectedClient?.city}, {selectedClient?.provinceName}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Info */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Fecha de Pedido</p>
              <p className="font-medium">{formatDate(formData.orderDate)}</p>
            </div>
            {formData.deliveryDate && (
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Entrega</p>
                <p className="font-medium">{formatDate(formData.deliveryDate)}</p>
              </div>
            )}
          </div>
          {formData.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notas</p>
              <p className="font-medium">{formData.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Artículos ({formData.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Precio Unit.</TableHead>
                <TableHead className="text-right">Desc.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formData.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.articleCode}</TableCell>
                  <TableCell>{item.articleDescription}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">
                    {item.discountPercent > 0 && (
                      <Badge variant="secondary">{item.discountPercent}%</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(calculateLineTotal(item))}
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
          <CardTitle>Resumen de Totales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-base">
            <span>Subtotal:</span>
            <span>{formatCurrency(calculateSubtotal())}</span>
          </div>
          {calculateTotalDiscount() > 0 && (
            <div className="flex justify-between text-base text-green-600">
              <span>Descuentos:</span>
              <span>- {formatCurrency(calculateTotalDiscount())}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold border-t pt-2">
            <span>Total:</span>
            <span>{formatCurrency(calculateTotal())}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


