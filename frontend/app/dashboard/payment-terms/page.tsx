'use client';

import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PaymentTermDialog } from '@/components/paymentTerms/PaymentTermDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/spinner';
import { usePaymentTerms, useDeletePaymentTerm } from '@/lib/hooks/usePaymentTerms';
import type { PaymentTerm } from '@/types/paymentTerm';

export default function PaymentTermsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<PaymentTerm | null>(null);

  const { data: paymentTerms, isLoading } = usePaymentTerms({ activeOnly: false });
  const deleteMutation = useDeletePaymentTerm();

  const handleEdit = (term: PaymentTerm) => {
    setEditingTerm(term);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Está seguro de eliminar esta condición de pago?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTerm(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Condiciones de Pago</h1>
          <p className="text-muted-foreground">Administrar las condiciones de pago disponibles</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Condición de Pago
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Condiciones de Pago</CardTitle>
          <CardDescription>{paymentTerms?.length || 0} condiciones registradas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <LoadingSpinner size="md" className="py-8" />}

          {paymentTerms && paymentTerms.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-right">Días</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentTerms.map((term) => (
                    <tr key={term.id} className="hover:bg-muted border-b">
                      <td className="px-4 py-3 font-medium">{term.code}</td>
                      <td className="px-4 py-3">{term.name}</td>
                      <td className="px-4 py-3 text-right">{term.days}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            term.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {term.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(term)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(term.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {paymentTerms && paymentTerms.length === 0 && !isLoading && (
            <div className="text-muted-foreground py-8 text-center">
              No hay condiciones de pago registradas
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentTermDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        paymentTerm={editingTerm}
      />
    </div>
  );
}
