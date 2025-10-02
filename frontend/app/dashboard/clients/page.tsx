'use client';

import { useState } from 'react';
import { useClients } from '@/lib/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import ClientsTable from '@/components/clients/ClientsTable';
import ClientDialog from '@/components/clients/ClientDialog';
import type { ClientDto } from '@/types/api';

export default function ClientsPage() {
  const [showActiveOnly] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientDto | null>(null);

  const { data: clients, isLoading, error } = useClients(showActiveOnly);

  const handleCreate = () => {
    setSelectedClient(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (client: ClientDto) => {
    setSelectedClient(client);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedClient(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground mt-2">
            Gestión de clientes del sistema
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            {clients?.length || 0} clientes registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-600">
              Error al cargar los clientes
            </div>
          )}

          {clients && (
            <ClientsTable
              clients={clients}
              onEdit={handleEdit}
            />
          )}
        </CardContent>
      </Card>

      <ClientDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        client={selectedClient}
      />
    </div>
  );
}

