import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CategoryPaymentDiscount, CategoryPaymentDiscountFormData } from '@/types/paymentTerm';

// Fetch category payment discounts
export function useCategoryPaymentDiscounts(categoryId: number) {
  return useQuery({
    queryKey: ['category-payment-discounts', categoryId],
    queryFn: async () => {
      const response = await fetch(`/api/categories/${categoryId}/payment-discounts`);
      if (!response.ok) {
        throw new Error('Failed to fetch category payment discounts');
      }
      const data = await response.json();
      return data.data as CategoryPaymentDiscount[];
    },
    enabled: categoryId > 0,
  });
}

// Update category payment discounts
export function useUpdateCategoryPaymentDiscounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      categoryId, 
      discounts 
    }: { 
      categoryId: number; 
      discounts: CategoryPaymentDiscountFormData[] 
    }) => {
      const response = await fetch(`/api/categories/${categoryId}/payment-discounts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discounts),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update category payment discounts');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['category-payment-discounts', variables.categoryId] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Descuentos por condición de pago actualizados correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar descuentos');
    },
  });
}

