'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreatePaymentTerm, useUpdatePaymentTerm } from '@/lib/hooks/domain/usePaymentTerms';
import type { PaymentTerm, PaymentTermFormData } from '@/types/paymentTerm';

const paymentTermSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(20, 'Máximo 20 caracteres'),
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  days: z.number().int().min(0, 'Los días no pueden ser negativos'),
  isActive: z.boolean().optional().default(true),
});

interface PaymentTermDialogProps {
  isOpen: boolean;
  onClose: () => void;
  paymentTerm?: PaymentTerm | null;
}

export function PaymentTermDialog({ isOpen, onClose, paymentTerm }: PaymentTermDialogProps) {
  const isEditing = !!paymentTerm;
  const createMutation = useCreatePaymentTerm();
  const updateMutation = useUpdatePaymentTerm();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentTermFormData>({
    resolver: zodResolver(paymentTermSchema),
    defaultValues: {
      code: '',
      name: '',
      days: 0,
      isActive: true,
    },
  });

  const isActive = watch('isActive');

  useEffect(() => {
    if (isEditing && paymentTerm) {
      setValue('code', paymentTerm.code);
      setValue('name', paymentTerm.name);
      setValue('days', paymentTerm.days);
      setValue('isActive', paymentTerm.isActive);
    } else if (!isEditing) {
      reset();
    }
  }, [paymentTerm, isEditing, setValue, reset]);

  const onSubmit = async (data: PaymentTermFormData) => {
    try {
      if (isEditing && paymentTerm) {
        await updateMutation.mutateAsync({ id: paymentTerm.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      reset();
      onClose();
    } catch (error) {
      console.error('Error submitting payment term:', error);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Condición de Pago' : 'Nueva Condición de Pago'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código *</Label>
            <Input id="code" {...register('code')} placeholder="Ej: 30D" disabled={isEditing} />
            {errors.code && <p className="text-destructive text-sm">{errors.code.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" {...register('name')} placeholder="Ej: 30 días" />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="days">Días *</Label>
            <Input
              id="days"
              type="number"
              {...register('days', { valueAsNumber: true })}
              placeholder="0"
            />
            {errors.days && <p className="text-destructive text-sm">{errors.days.message}</p>}
            <p className="text-muted-foreground text-sm">0 = Contado, 30 = 30 días, etc.</p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setValue('isActive', checked as boolean)}
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Activo
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
