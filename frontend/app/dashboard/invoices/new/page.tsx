'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateInvoice } from '@/lib/hooks/useInvoices';
import { useSalesOrders } from '@/lib/hooks/useSalesOrders';
import { useSystemSettings } from '@/lib/hooks/useSettings';

export default function NewInvoicePage() {
  const router = useRouter();
  const createInvoiceMutation = useCreateInvoice();
  const { data: settings } = useSystemSettings();

  const [formData, setFormData] = useState({
    salesOrderId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    usdExchangeRate: '',
    specialDiscountPercent: '0',
    notes: '',
  });

  // Fetch pending sales orders
  const { data: salesOrdersData } = useSalesOrders({
    pageNumber: 1,
    pageSize: 100,
    status: 'PENDING',
    activeOnly: true,
  });

  // Pre-fill exchange rate from system settings
  useEffect(() => {
    if (settings && !formData.usdExchangeRate) {
      setFormData(prev => ({
        ...prev,
        usdExchangeRate: settings.usdExchangeRate.toString()
      }));
    }
  }, [settings, formData.usdExchangeRate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.salesOrderId) {
      return;
    }

    createInvoiceMutation.mutate(
      {
        salesOrderId: Number(formData.salesOrderId),
        invoiceDate: formData.invoiceDate,
        usdExchangeRate: formData.usdExchangeRate ? Number(formData.usdExchangeRate) : null,
        specialDiscountPercent: Number(formData.specialDiscountPercent),
        notes: formData.notes || null,
      },
      {
        onSuccess: (data) => {
          // Stay on the form after creating invoice
          // Navigate to edit view to allow further modifications
          router.push(`/dashboard/invoices/${data.id}`);
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/dashboard/invoices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nueva Factura</h1>
          <p className="text-muted-foreground">Crear una nueva factura desde un pedido</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Datos de la Factura</CardTitle>
            <CardDescription>
              Seleccione el pedido y complete los datos de la factura
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="salesOrderId">Pedido *</Label>
              <Select
                value={formData.salesOrderId}
                onValueChange={(value) =>
                  setFormData({ ...formData, salesOrderId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un pedido pendiente" />
                </SelectTrigger>
                <SelectContent>
                  {salesOrdersData?.data.map((order) => (
                    <SelectItem key={order.id} value={order.id.toString()}>
                      {order.orderNumber} - {order.clientBusinessName} - ${order.total.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Fecha de Factura *</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={formData.invoiceDate}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceDate: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usdExchangeRate">Tipo de Cambio USD a ARS *</Label>
              <Input
                id="usdExchangeRate"
                type="number"
                step="0.01"
                placeholder="Ej: 1000.50"
                value={formData.usdExchangeRate}
                onChange={(e) =>
                  setFormData({ ...formData, usdExchangeRate: e.target.value })
                }
                required
              />
              <p className="text-sm text-muted-foreground">
                Los precios están en USD. Este valor se usa para convertir a pesos argentinos.
                {settings && ` Valor actual del sistema: $${settings.usdExchangeRate.toFixed(2)}`}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialDiscountPercent">Descuento Especial (%)</Label>
              <Input
                id="specialDiscountPercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.specialDiscountPercent}
                onChange={(e) =>
                  setFormData({ ...formData, specialDiscountPercent: e.target.value })
                }
              />
              <p className="text-sm text-muted-foreground">
                Descuento adicional aplicado después de descuentos por artículo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observaciones</Label>
              <Textarea
                id="notes"
                placeholder="Ingrese observaciones o notas adicionales"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/invoices')}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!formData.salesOrderId || !formData.usdExchangeRate || createInvoiceMutation.isPending}
          >
            {createInvoiceMutation.isPending ? 'Creando...' : 'Crear Factura'}
          </Button>
        </div>
      </form>
    </div>
  );
}



