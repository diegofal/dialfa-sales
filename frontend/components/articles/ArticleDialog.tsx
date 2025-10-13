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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Article, ArticleFormData } from '@/types/article';
import { useCreateArticle, useUpdateArticle } from '@/lib/hooks/useArticles';
import { useCategories } from '@/lib/hooks/useCategories';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const articleSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(50, 'Máximo 50 caracteres'),
  description: z.string().min(1, 'La descripción es requerida').max(500, 'Máximo 500 caracteres'),
  categoryId: z.number().min(1, 'Debe seleccionar una categoría'),
  unitPrice: z.number().min(0, 'El precio no puede ser negativo'),
  stock: z.number().min(0, 'El stock no puede ser negativo'),
  minimumStock: z.number().min(0, 'El stock mínimo no puede ser negativo'),
  location: z.string().max(100, 'Máximo 100 caracteres').optional(),
  isDiscontinued: z.boolean(),
  notes: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
});

type ArticleFormValues = z.infer<typeof articleSchema>;

interface ArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article?: Article | null;
}

export function ArticleDialog({ open, onOpenChange, article }: ArticleDialogProps) {
  const isEditing = !!article;
  const createMutation = useCreateArticle();
  const updateMutation = useUpdateArticle();
  const { data: categories, isLoading: categoriesLoading } = useCategories(true);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      code: '',
      description: '',
      categoryId: 0,
      unitPrice: 0,
      stock: 0,
      minimumStock: 0,
      location: '',
      isDiscontinued: false,
      notes: '',
    },
  });

  const categoryId = watch('categoryId');
  const isDiscontinued = watch('isDiscontinued');

  useEffect(() => {
    if (article) {
      reset({
        code: article.code,
        description: article.description,
        categoryId: article.categoryId,
        unitPrice: article.unitPrice,
        stock: article.stock,
        minimumStock: article.minimumStock,
        location: article.location || '',
        isDiscontinued: article.isDiscontinued,
        notes: article.notes || '',
      });
    } else {
      reset({
        code: '',
        description: '',
        categoryId: 0,
        unitPrice: 0,
        stock: 0,
        minimumStock: 0,
        location: '',
        isDiscontinued: false,
        notes: '',
      });
    }
  }, [article, reset]);

  const onSubmit = async (data: ArticleFormValues) => {
    const formData: ArticleFormData = {
      code: data.code,
      description: data.description,
      categoryId: data.categoryId,
      unitPrice: data.unitPrice,
      stock: data.stock,
      minimumStock: data.minimumStock,
      location: data.location || undefined,
      isDiscontinued: data.isDiscontinued ?? false,
      notes: data.notes || undefined,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: article.id, article: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      onOpenChange(false);
      reset();
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Error submitting article:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Artículo' : 'Nuevo Artículo'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input id="code" {...register('code')} />
              {errors.code && (
                <p className="text-sm text-red-500">{errors.code.message}</p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoría *</Label>
              <Select
                value={categoryId > 0 ? categoryId.toString() : ''}
                onValueChange={(value) => setValue('categoryId', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categoriesLoading ? (
                    <SelectItem value="0" disabled>
                      Cargando...
                    </SelectItem>
                  ) : (
                    categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.categoryId && (
                <p className="text-sm text-red-500">{errors.categoryId.message}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción *</Label>
            <Textarea id="description" {...register('description')} rows={2} />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Unit Price */}
            <div className="space-y-2">
              <Label htmlFor="unitPrice">Precio Unitario *</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                {...register('unitPrice', { valueAsNumber: true })}
              />
              {errors.unitPrice && (
                <p className="text-sm text-red-500">{errors.unitPrice.message}</p>
              )}
            </div>

            {/* Stock */}
            <div className="space-y-2">
              <Label htmlFor="stock">Stock Actual *</Label>
              <Input
                id="stock"
                type="number"
                {...register('stock', { valueAsNumber: true })}
              />
              {errors.stock && (
                <p className="text-sm text-red-500">{errors.stock.message}</p>
              )}
            </div>

            {/* Minimum Stock */}
            <div className="space-y-2">
              <Label htmlFor="minimumStock">Stock Mínimo *</Label>
              <Input
                id="minimumStock"
                type="number"
                {...register('minimumStock', { valueAsNumber: true })}
              />
              {errors.minimumStock && (
                <p className="text-sm text-red-500">{errors.minimumStock.message}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Ubicación</Label>
            <Input id="location" {...register('location')} placeholder="Ej: Depósito A - Estante 3" />
            {errors.location && (
              <p className="text-sm text-red-500">{errors.location.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" {...register('notes')} rows={3} />
            {errors.notes && (
              <p className="text-sm text-red-500">{errors.notes.message}</p>
            )}
          </div>

          {/* Is Discontinued */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDiscontinued"
              checked={isDiscontinued}
              onCheckedChange={(checked) => setValue('isDiscontinued', checked as boolean)}
            />
            <Label htmlFor="isDiscontinued" className="font-normal cursor-pointer">
              Producto descontinuado
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {isEditing ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

