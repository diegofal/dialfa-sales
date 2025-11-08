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
import { useCreateDeliveryNote, useUpdateDeliveryNote } from '@/lib/hooks/useDeliveryNotes';
import { useSalesOrders } from '@/lib/hooks/useSalesOrders';
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
    }
  }, [deliveryNote, preselectedSalesOrderId, reset, setValue]);

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
        await createMutation.mutateAsync({
          salesOrderId: data.salesOrderId,
          deliveryDate: data.deliveryDate,
          transporterId: data.transporterId,
          weightKg: data.weightKg,
          packagesCount: data.packagesCount,
          declaredValue: data.declaredValue,
          notes: data.notes,
        });
      }
      onOpenChange(false);
      reset();
    } catch (error) {
      console.error('Error saving delivery note:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Remito' : 'Nuevo Remito'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos del remito'
              : 'Crea un nuevo remito de entrega desde un pedido'}
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
                onValueChange={(value) => setValue('salesOrderId', parseInt(value))}
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

