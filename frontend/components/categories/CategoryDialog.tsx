'use client';

import { useEffect, useState } from 'react';
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
import { usePaymentTerms } from '@/lib/hooks/usePaymentTerms';
import { useCategoryPaymentDiscounts, useUpdateCategoryPaymentDiscounts } from '@/lib/hooks/useCategoryPaymentDiscounts';
import type { CategoryFormData } from '@/types/category';
import type { CategoryPaymentDiscountFormData } from '@/types/paymentTerm';

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
  
  // Payment terms and discounts
  const { data: paymentTerms } = usePaymentTerms(true);
  const { data: categoryDiscounts, isLoading: isLoadingDiscounts } = useCategoryPaymentDiscounts(categoryId || 0);
  const updateDiscountsMutation = useUpdateCategoryPaymentDiscounts();
  
  const [discounts, setDiscounts] = useState<Record<number, number>>({});

  // Debug logs
  console.log('CategoryDialog render:', {
    isOpen,
    categoryId,
    isEditing,
    categoryDiscounts,
    isLoadingDiscounts,
    discountsState: discounts,
  });

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
      // Asegurar que el descuento sea un número válido
      const discountValue = typeof category.defaultDiscountPercent === 'number' 
        ? category.defaultDiscountPercent 
        : parseFloat(String(category.defaultDiscountPercent || 0));
      setValue('defaultDiscountPercent', discountValue);
    } else if (!isEditing) {
      reset();
      setDiscounts({});
    }
  }, [category, isEditing, setValue, reset]);

  // Load payment term discounts when dialog opens or category changes
  useEffect(() => {
    if (isOpen && categoryDiscounts && categoryDiscounts.length > 0) {
      console.log('Loading category discounts:', categoryDiscounts);
      const discountMap: Record<number, number> = {};
      categoryDiscounts.forEach(d => {
        discountMap[d.paymentTermId] = d.discountPercent;
      });
      console.log('Discount map:', discountMap);
      setDiscounts(discountMap);
    } else if (isOpen && !isEditing) {
      // Reset discounts for new category
      console.log('Resetting discounts for new category');
      setDiscounts({});
    }
  }, [isOpen, categoryDiscounts, isEditing]);

  const onSubmit = async (data: CategoryFormData) => {
    try {
      let savedCategoryId = categoryId;
      
      if (isEditing && categoryId) {
        await updateMutation.mutateAsync({ id: categoryId, data });
      } else {
        const newCategory = await createMutation.mutateAsync(data);
        savedCategoryId = newCategory.id;
      }
      
      // Save payment term discounts if editing or after creating
      if (savedCategoryId && paymentTerms) {
        const discountData: CategoryPaymentDiscountFormData[] = paymentTerms.map(term => ({
          paymentTermId: term.id,
          discountPercent: discounts[term.id] || 0,
        }));
        
        await updateDiscountsMutation.mutateAsync({
          categoryId: savedCategoryId,
          discounts: discountData,
        });
      }
      
      reset();
      setDiscounts({});
      onClose();
    } catch (error) {
      // Error handled by mutation
      console.error('Error submitting category:', error);
    }
  };

  const handleClose = () => {
    reset();
    setDiscounts({});
    onClose();
  };

  const handleDiscountChange = (paymentTermId: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setDiscounts(prev => ({ ...prev, [paymentTermId]: numValue }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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
            <Label htmlFor="defaultDiscountPercent">Descuento por defecto (%) - Deprecado</Label>
            <Input
              id="defaultDiscountPercent"
              type="number"
              step="0.01"
              {...register('defaultDiscountPercent', { valueAsNumber: true })}
              placeholder="0.00"
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Este campo está deprecado. Use los descuentos por condición de pago a continuación.
            </p>
          </div>

          {paymentTerms && paymentTerms.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <Label>Descuentos por Condición de Pago</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Configure el descuento para cada condición de pago disponible
              </p>
              {isEditing && !categoryDiscounts && (
                <div className="text-sm text-gray-500 py-2">Cargando descuentos...</div>
              )}
              <div className="space-y-2">
                {paymentTerms.map(term => {
                  const currentDiscount = discounts[term.id] || 0;
                  return (
                    <div key={term.id} className="flex items-center gap-2">
                      <Label className="w-40 text-sm">{term.name}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={currentDiscount}
                        onChange={(e) => handleDiscountChange(term.id, e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      <span className="text-xs text-muted-foreground">({term.days} días)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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










