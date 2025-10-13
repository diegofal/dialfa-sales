'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Edit, Trash2, Package } from 'lucide-react';
import { useDeleteCategory } from '@/lib/hooks/useCategories';
import type { Category } from '@/types/category';
import { Badge } from '@/components/ui/badge';

interface CategoriesTableProps {
  categories: Category[];
  onEdit: (id: number) => void;
}

export function CategoriesTable({ categories, onEdit }: CategoriesTableProps) {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteMutation = useDeleteCategory();

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Descuento (%)</TableHead>
              <TableHead className="text-center">Artículos</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No hay categorías registradas
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.code}</TableCell>
                  <TableCell className="font-semibold">{category.name}</TableCell>
                  <TableCell className="text-gray-600">
                    {category.description || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {category.defaultDiscountPercent.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Package className="h-4 w-4 text-gray-500" />
                      <span>{category.articlesCount}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {category.isDeleted ? (
                      <Badge variant="destructive">Eliminada</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-600">
                        Activa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(category.id)}
                        disabled={category.isDeleted}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteId(category.id)}
                        disabled={category.isDeleted}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará la categoría como eliminada. Los artículos asociados no
              se eliminarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}








