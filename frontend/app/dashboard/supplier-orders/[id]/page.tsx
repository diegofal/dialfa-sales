'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSupplierOrder, useUpdateSupplierOrderStatus } from '@/lib/hooks/useSupplierOrders';
import { useAuthStore } from '@/store/authStore';
import { SupplierOrderStatus, SupplierOrderItemDto } from '@/types/supplierOrder';
import { formatSaleTime } from '@/lib/utils/salesCalculations';

const STATUS_LABELS: Record<SupplierOrderStatus, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  sent: 'Enviado',
  in_transit: 'En Tránsito',
  received: 'Recibido',
  cancelled: 'Cancelado',
};

const STATUS_OPTIONS: { value: SupplierOrderStatus; label: string; disabled?: boolean }[] = [
  { value: 'draft', label: 'Borrador' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'sent', label: 'Enviado' },
  { value: 'in_transit', label: 'En Tránsito' },
  { value: 'received', label: 'Recibido' },
  { value: 'cancelled', label: 'Cancelado' },
];

export default function SupplierOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { isAdmin } = useAuthStore();
  const canEdit = isAdmin();

  const { data, isLoading } = useSupplierOrder(parseInt(id));
  const updateStatus = useUpdateSupplierOrderStatus();

  const order = data?.data;

  const handleStatusChange = (newStatus: string) => {
    if (!order) return;
    updateStatus.mutate({ id: order.id, status: newStatus as SupplierOrderStatus });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Cargando pedido...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Pedido no encontrado
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard/supplier-orders')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Pedido {order.orderNumber}</h1>
          <p className="text-muted-foreground">
            Creado el {new Date(order.orderDate).toLocaleDateString('es-AR')}
          </p>
        </div>
      </div>

      {/* Order Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Información del Pedido</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Proveedor</div>
              <div className="font-medium">{order.supplierName || 'Sin asignar'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Estado</div>
              <div>
                {canEdit ? (
                  <Select
                    value={order.status}
                    onValueChange={handleStatusChange}
                    disabled={updateStatus.isPending}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge>{STATUS_LABELS[order.status as SupplierOrderStatus]}</Badge>
                )}
              </div>
            </div>
            {order.expectedDeliveryDate && (
              <div>
                <div className="text-sm text-muted-foreground">Fecha Entrega Esperada</div>
                <div>{new Date(order.expectedDeliveryDate).toLocaleDateString('es-AR')}</div>
              </div>
            )}
            {order.actualDeliveryDate && (
              <div>
                <div className="text-sm text-muted-foreground">Fecha Entrega Real</div>
                <div>{new Date(order.actualDeliveryDate).toLocaleDateString('es-AR')}</div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Resumen</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Total Artículos</div>
              <div className="text-2xl font-bold">{order.totalItems}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Unidades</div>
              <div className="text-2xl font-bold">{order.totalQuantity}</div>
            </div>
            {order.estimatedSaleTimeMonths && (
              <div>
                <div className="text-sm text-muted-foreground">Tiempo Est. Venta</div>
                <div className="text-lg font-semibold">
                  {formatSaleTime(order.estimatedSaleTimeMonths)}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Artículos del Pedido
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Stock Actual</TableHead>
              <TableHead className="text-right">Stock Mín.</TableHead>
              <TableHead className="text-right">Venta Prom/Mes</TableHead>
              <TableHead className="text-right">Tiempo Est.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items?.map((item: SupplierOrderItemDto) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-medium">
                  {item.articleCode}
                </TableCell>
                <TableCell>
                  <div className="max-w-md truncate">{item.articleDescription}</div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {item.quantity}
                </TableCell>
                <TableCell className="text-right">
                  {item.currentStock.toFixed(0)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.minimumStock.toFixed(0)}
                </TableCell>
                <TableCell className="text-right">
                  {item.avgMonthlySales
                    ? item.avgMonthlySales.toFixed(1)
                    : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {item.estimatedSaleTime ? (
                    <Badge variant="secondary">
                      {formatSaleTime(item.estimatedSaleTime)}
                    </Badge>
                  ) : (
                    '-'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {order.notes && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Notas</h2>
          <p className="text-muted-foreground">{order.notes}</p>
        </Card>
      )}
    </div>
  );
}


