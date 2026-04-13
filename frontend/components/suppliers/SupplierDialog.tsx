'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useSupplier, useCreateSupplier, useUpdateSupplier } from '@/lib/hooks/domain/useSuppliers';
import type { SupplierFormData } from '@/types/supplier';

const supplierSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(20, 'Máximo 20 caracteres'),
  name: z.string().min(1, 'El nombre es requerido').max(200, 'Máximo 200 caracteres'),
  contactName: z.string().max(100, 'Máximo 100 caracteres').optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(50, 'Máximo 50 caracteres').optional().or(z.literal('')),
  address: z.string().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
  notes: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
  isActive: z.boolean(),
});

interface SupplierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId?: number | null;
}

export function SupplierDialog({ isOpen, onClose, supplierId }: SupplierDialogProps) {
  const isEditing = !!supplierId;
  const { data: supplier } = useSupplier(supplierId || 0);
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      code: '',
      name: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
      isActive: true,
    },
  });

  const isActive = watch('isActive');

  useEffect(() => {
    if (isEditing && supplier) {
      setValue('code', supplier.code);
      setValue('name', supplier.name);
      setValue('contactName', supplier.contactName || '');
      setValue('email', supplier.email || '');
      setValue('phone', supplier.phone || '');
      setValue('address', supplier.address || '');
      setValue('notes', supplier.notes || '');
      setValue('isActive', supplier.isActive);
    }
  }, [isEditing, supplier, setValue]);

  const onSubmit = async (data: SupplierFormData) => {
    if (isEditing && supplierId) {
      await updateMutation.mutateAsync({ id: supplierId, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    handleClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input id="code" {...register('code')} placeholder="Ej: BESTFLOW" />
              {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" {...register('name')} placeholder="Nombre del proveedor" />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Contacto</Label>
              <Input
                id="contactName"
                {...register('contactName')}
                placeholder="Nombre de contacto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="email@ejemplo.com"
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" {...register('phone')} placeholder="+54 11 1234-5678" />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setValue('isActive', checked)}
              />
              <Label htmlFor="isActive">{isActive ? 'Activo' : 'Inactivo'}</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input id="address" {...register('address')} placeholder="Dirección completa" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" {...register('notes')} placeholder="Notas adicionales" rows={2} />
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
