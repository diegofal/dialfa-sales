'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClickableTableRow } from '@/components/ui/clickable-table-row';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { ACTION_BUTTON_CONFIG } from '@/lib/constants/tableActions';
import { useDeleteSupplier } from '@/lib/hooks/domain/useSuppliers';
import type { Supplier } from '@/types/supplier';

interface SuppliersTableProps {
  suppliers: Supplier[];
  onEdit: (id: number) => void;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
}

export function SuppliersTable({
  suppliers,
  onEdit,
  currentSortBy,
  currentSortDescending,
  onSort,
}: SuppliersTableProps) {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteMutation = useDeleteSupplier();

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                sortKey="Code"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                Código
              </SortableTableHead>
              <SortableTableHead
                sortKey="Name"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                Nombre
              </SortableTableHead>
              <SortableTableHead>Contacto</SortableTableHead>
              <SortableTableHead>Email</SortableTableHead>
              <SortableTableHead>Teléfono</SortableTableHead>
              <SortableTableHead align="center">Estado</SortableTableHead>
              <SortableTableHead align="right">Acciones</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                  No hay proveedores registrados
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <ClickableTableRow
                  key={supplier.id}
                  onRowClick={() => onEdit(supplier.id)}
                  aria-label={`Editar proveedor ${supplier.name}`}
                >
                  <TableCell className="font-mono font-medium">{supplier.code}</TableCell>
                  <TableCell className="font-semibold">{supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {supplier.contactName || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{supplier.email || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.phone || '-'}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={supplier.isActive ? 'default' : 'destructive'}
                      className={supplier.isActive ? 'bg-green-600' : ''}
                    >
                      {supplier.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant={ACTION_BUTTON_CONFIG.edit.variant}
                        size={ACTION_BUTTON_CONFIG.edit.size}
                        onClick={() => onEdit(supplier.id)}
                        title={ACTION_BUTTON_CONFIG.edit.title}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={ACTION_BUTTON_CONFIG.delete.variant}
                        size={ACTION_BUTTON_CONFIG.delete.size}
                        onClick={() => setDeleteId(supplier.id)}
                        title={ACTION_BUTTON_CONFIG.delete.title}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </ClickableTableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Si el proveedor tiene pedidos asociados, se marcará como inactivo. Si no tiene
              pedidos, se eliminará permanentemente.
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
