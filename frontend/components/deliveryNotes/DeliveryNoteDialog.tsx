'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateDeliveryNote, useUpdateDeliveryNote } from '@/lib/hooks/useDeliveryNotes';
import { useSalesOrders } from '@/lib/hooks/useSalesOrders';
import { useSalesOrder } from '@/lib/hooks/useSalesOrders';
import { useTransporters } from '@/lib/hooks/useLookups';
import type { DeliveryNote } from '@/types/deliveryNote';

const deliveryNoteSchema = z.object({
  salesOrderId: z.number().min(1, 'Debe seleccionar un pedido'),
  deliveryDate: z.string().min(1, 'La fecha de entrega es requerida'),
  transporterId: z.number().nullable(),
  weightKg: z.number().nullable(),
  packagesCount: z.number().nullable(),
  declaredValue: z.number().nullable(),
  notes: z.string().nullable(),
});

type DeliveryNoteFormValues = z.infer<typeof deliveryNoteSchema>;

interface DeliveryNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryNote?: DeliveryNote;
  preselectedSalesOrderId?: number;
}

export function DeliveryNoteDialog({
  open,
  onOpenChange,
  deliveryNote,
  preselectedSalesOrderId,
}: DeliveryNoteDialogProps) {
  const isEditing = !!deliveryNote;
  const createMutation = useCreateDeliveryNote();
  const updateMutation = useUpdateDeliveryNote();
  
  const { data: salesOrdersData } = useSalesOrders({ 
    pageSize: 100, 
    status: 'PENDING',
    activeOnly: true 
  });
  const { data: transportersData } = useTransporters();

  const [selectedOrderId, setSelectedOrderId] = useState<number>(preselectedSalesOrderId || 0);
  const { data: selectedOrder } = useSalesOrder(selectedOrderId);
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<DeliveryNoteFormValues>({
    resolver: zodResolver(deliveryNoteSchema),
    defaultValues: {
      salesOrderId: preselectedSalesOrderId || 0,
      deliveryDate: new Date().toISOString().split('T')[0],
      transporterId: null,
      weightKg: null,
      packagesCount: null,
      declaredValue: null,
      notes: null,
    },
  });

  useEffect(() => {
    if (deliveryNote) {
      reset({
        salesOrderId: deliveryNote.salesOrderId,
        deliveryDate: deliveryNote.deliveryDate.split('T')[0],
        transporterId: deliveryNote.transporterId,
        weightKg: deliveryNote.weightKg,
        packagesCount: deliveryNote.packagesCount,
        declaredValue: deliveryNote.declaredValue,
        notes: deliveryNote.notes,
      });
    } else if (preselectedSalesOrderId) {
      setValue('salesOrderId', preselectedSalesOrderId);
      setSelectedOrderId(preselectedSalesOrderId);
    }
  }, [deliveryNote, preselectedSalesOrderId, reset, setValue]);

  // Initialize item quantities when order is loaded
  useEffect(() => {
    if (selectedOrder && selectedOrder.items) {
      const initialQuantities: Record<number, number> = {};
      selectedOrder.items.forEach((item) => {
        initialQuantities[item.id] = item.quantity;
      });
      setItemQuantities(initialQuantities);
    }
  }, [selectedOrder]);

  const handleOrderChange = (orderId: number) => {
    setSelectedOrderId(orderId);
    setValue('salesOrderId', orderId);
    setItemQuantities({});
  };

  const handleQuantityChange = (itemId: number, quantity: number) => {
    setItemQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0, quantity),
    }));
  };

  const onSubmit = async (data: DeliveryNoteFormValues) => {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: deliveryNote.id,
          data: {
            deliveryDate: data.deliveryDate,
            transporterId: data.transporterId,
            weightKg: data.weightKg,
            packagesCount: data.packagesCount,
            declaredValue: data.declaredValue,
            notes: data.notes,
          },
        });
      } else {
        // Build items array from selected quantities
        const items = selectedOrder?.items
          .filter((item) => itemQuantities[item.id] > 0)
          .map((item) => ({
            salesOrderItemId: item.id,
            articleId: item.articleId,
            articleCode: item.articleCode,
            articleDescription: item.articleDescription,
            quantity: itemQuantities[item.id],
          })) || [];

        if (items.length === 0) {
          alert('Debe seleccionar al menos un item con cantidad mayor a 0');
          return;
        }

        await createMutation.mutateAsync({
          salesOrderId: data.salesOrderId,
          deliveryDate: data.deliveryDate,
          transporterId: data.transporterId,
          weightKg: data.weightKg,
          packagesCount: data.packagesCount,
          declaredValue: data.declaredValue,
          notes: data.notes,
          items,
        });
      }
      reset();
      setItemQuantities({});
    } catch (error) {
      console.error('Error saving delivery note:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Remito' : 'Nuevo Remito'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos del remito'
              : 'Crea un nuevo remito de entrega. Puede seleccionar envío parcial ajustando las cantidades.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Sales Order Selection */}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="salesOrderId">
                Pedido <span className="text-red-500">*</span>
              </Label>
              <Select
                value={watch('salesOrderId')?.toString() || ''}
                onValueChange={(value) => handleOrderChange(parseInt(value))}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar pedido" />
                </SelectTrigger>
                <SelectContent>
                  {salesOrdersData?.data.map((order) => (
                    <SelectItem key={order.id} value={order.id.toString()}>
                      {order.orderNumber} - {order.clientBusinessName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.salesOrderId && (
                <p className="text-sm text-red-500">{errors.salesOrderId.message}</p>
              )}
            </div>

            {/* Items Selection - Only for creation */}
            {!isEditing && selectedOrder && selectedOrder.items && selectedOrder.items.length > 0 && (
              <div className="col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Items a Entregar</CardTitle>
                    <CardDescription>
                      Ajuste las cantidades para envío parcial. Por defecto se entregan todas las cantidades del pedido.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Cant. Pedido</TableHead>
                          <TableHead className="text-right">Cant. a Entregar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedOrder.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.articleCode}</TableCell>
                            <TableCell>{item.articleDescription}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={itemQuantities[item.id] || 0}
                                onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                                className="w-24 text-right"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Delivery Date */}
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">
                Fecha de Entrega <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deliveryDate"
                type="date"
                {...register('deliveryDate')}
              />
              {errors.deliveryDate && (
                <p className="text-sm text-red-500">{errors.deliveryDate.message}</p>
              )}
            </div>

            {/* Transporter */}
            <div className="space-y-2">
              <Label htmlFor="transporterId">Transportista</Label>
              <Select
                value={watch('transporterId')?.toString() || ''}
                onValueChange={(value) => 
                  setValue('transporterId', value ? parseInt(value) : null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar transportista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin transportista</SelectItem>
                  {transportersData?.map((transporter) => (
                    <SelectItem key={transporter.id} value={transporter.id.toString()}>
                      {transporter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Weight */}
            <div className="space-y-2">
              <Label htmlFor="weightKg">Peso (kg)</Label>
              <Input
                id="weightKg"
                type="number"
                step="0.01"
                {...register('weightKg', { 
                  setValueAs: (v) => v === '' ? null : parseFloat(v) 
                })}
              />
            </div>

            {/* Packages Count */}
            <div className="space-y-2">
              <Label htmlFor="packagesCount">Cantidad de Bultos</Label>
              <Input
                id="packagesCount"
                type="number"
                {...register('packagesCount', { 
                  setValueAs: (v) => v === '' ? null : parseInt(v) 
                })}
              />
            </div>

            {/* Declared Value */}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="declaredValue">Valor Declarado</Label>
              <Input
                id="declaredValue"
                type="number"
                step="0.01"
                {...register('declaredValue', { 
                  setValueAs: (v) => v === '' ? null : parseFloat(v) 
                })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="notes">Observaciones</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {isEditing ? 'Actualizar' : 'Crear'} Remito
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



