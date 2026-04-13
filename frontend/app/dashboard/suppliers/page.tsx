'use client';

import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { SupplierDialog } from '@/components/suppliers/SupplierDialog';
import { SuppliersTable } from '@/components/suppliers/SuppliersTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/spinner';
import { useSuppliers } from '@/lib/hooks/domain/useSuppliers';

export default function SuppliersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useSuppliers({
    activeOnly: false,
    searchTerm: searchTerm || undefined,
  });

  const suppliers = data?.data || [];

  const handleEdit = (id: number) => {
    setEditingId(id);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-muted-foreground">Gestión de proveedores</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Proveedor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Proveedores</CardTitle>
              <CardDescription>{suppliers.length} proveedores registrados</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
              <Input
                placeholder="Buscar proveedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <LoadingSpinner size="md" className="py-8" />}

          {!isLoading && suppliers.length > 0 && (
            <SuppliersTable suppliers={suppliers} onEdit={handleEdit} />
          )}

          {!isLoading && suppliers.length === 0 && (
            <div className="text-muted-foreground py-8 text-center">
              No se encontraron proveedores
            </div>
          )}
        </CardContent>
      </Card>

      <SupplierDialog isOpen={isDialogOpen} onClose={handleCloseDialog} supplierId={editingId} />
    </div>
  );
}
