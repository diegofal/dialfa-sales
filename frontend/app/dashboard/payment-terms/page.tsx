'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { usePaymentTerms, useDeletePaymentTerm } from '@/lib/hooks/usePaymentTerms';
import { PaymentTermDialog } from '@/components/paymentTerms/PaymentTermDialog';
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Condiciones de Pago</h1>
          <p className="text-gray-600 mt-1">
            Administrar las condiciones de pago disponibles
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Condición de Pago
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Condiciones de Pago</CardTitle>
          <CardDescription>
            {paymentTerms?.length || 0} condiciones registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          )}

          {paymentTerms && paymentTerms.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Código</th>
                    <th className="text-left py-3 px-4">Nombre</th>
                    <th className="text-right py-3 px-4">Días</th>
                    <th className="text-center py-3 px-4">Estado</th>
                    <th className="text-right py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentTerms.map((term) => (
                    <tr key={term.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{term.code}</td>
                      <td className="py-3 px-4">{term.name}</td>
                      <td className="py-3 px-4 text-right">{term.days}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          term.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {term.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(term)}
                          >
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
            <div className="text-center py-8 text-muted-foreground">
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

