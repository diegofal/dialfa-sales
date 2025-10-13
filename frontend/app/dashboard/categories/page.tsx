'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CategoryDialog } from '@/components/categories/CategoryDialog';
import { CategoriesTable } from '@/components/categories/CategoriesTable';
import { useCategories } from '@/lib/hooks/useCategories';

export default function CategoriesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { data: categories, isLoading } = useCategories(false);

  const handleEdit = (id: number) => {
    setEditingId(id);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Categorías</h1>
          <p className="text-gray-600 mt-1">
            Gestiona las categorías de productos ({categories?.length || 0} categorías)
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Categoría
        </Button>
      </div>

      <CategoriesTable
        categories={categories || []}
        onEdit={handleEdit}
      />

      <CategoryDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        categoryId={editingId}
      />
    </div>
  );
}








