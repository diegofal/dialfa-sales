'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCategory, useCreateCategory, useUpdateCategory } from '@/lib/hooks/useCategories';
import type { CategoryFormData } from '@/types/category';

const categorySchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(20, 'Máximo 20 caracteres'),
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
  defaultDiscountPercent: z.number().min(0, 'El descuento no puede ser negativo').max(100, 'El descuento no puede ser mayor a 100'),
});

interface CategoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId?: number | null;
}

export function CategoryDialog({ isOpen, onClose, categoryId }: CategoryDialogProps) {
  const isEditing = !!categoryId;
  const { data: category } = useCategory(categoryId || 0);
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      defaultDiscountPercent: 0,
    },
  });

  useEffect(() => {
    if (isEditing && category) {
      setValue('code', category.code);
      setValue('name', category.name);
      setValue('description', category.description || '');
      setValue('defaultDiscountPercent', category.defaultDiscountPercent);
    } else if (!isEditing) {
      reset();
    }
  }, [category, isEditing, setValue, reset]);

  const onSubmit = async (data: CategoryFormData) => {
    try {
      if (isEditing && categoryId) {
        await updateMutation.mutateAsync({ id: categoryId, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      reset();
      onClose();
    } catch (error) {
      // Error handled by mutation
      console.error('Error submitting category:', error);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Categoría' : 'Nueva Categoría'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código *</Label>
            <Input
              id="code"
              {...register('code')}
              placeholder="Ej: CAT001"
            />
            {errors.code && (
              <p className="text-sm text-red-600">{errors.code.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ej: Electrónica"
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descripción de la categoría (opcional)"
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultDiscountPercent">Descuento por defecto (%)</Label>
            <Input
              id="defaultDiscountPercent"
              type="number"
              step="0.01"
              {...register('defaultDiscountPercent', { valueAsNumber: true })}
              placeholder="0.00"
            />
            {errors.defaultDiscountPercent && (
              <p className="text-sm text-red-600">{errors.defaultDiscountPercent.message}</p>
            )}
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









