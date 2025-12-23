'use client';

import { useState } from 'react';
import type { ClientDto } from '@/types/api';
import { useDeleteClient } from '@/lib/hooks/useClients';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClickableTableRow } from '@/components/ui/clickable-table-row';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Pencil, Trash2 } from 'lucide-react';
import { ACTION_BUTTON_CONFIG } from '@/lib/constants/tableActions';
import { formatCuit } from '@/lib/utils';

interface ClientsTableProps {
  clients: ClientDto[];
  onEdit: (client: ClientDto) => void;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
}

export default function ClientsTable({ 
  clients, 
  onEdit,
  currentSortBy,
  currentSortDescending,
  onSort 
}: ClientsTableProps) {
  const [clientToDelete, setClientToDelete] = useState<ClientDto | null>(null);
  const deleteClientMutation = useDeleteClient();

  const handleDelete = () => {
    if (clientToDelete) {
      deleteClientMutation.mutate(clientToDelete.id);
      setClientToDelete(null);
    }
  };

  return (
    <>
      <div className="rounded-md border">
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
                sortKey="BusinessName"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                Razón Social
              </SortableTableHead>
              <SortableTableHead
                sortKey="Cuit"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                CUIT
              </SortableTableHead>
              <SortableTableHead
                sortKey="City"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                Ciudad
              </SortableTableHead>
              <SortableTableHead>Estado</SortableTableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hay clientes registrados
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <ClickableTableRow
                  key={client.id}
                  onRowClick={() => onEdit(client)}
                  aria-label={`Editar cliente ${client.businessName}`}
                >
                  <TableCell className="font-medium">{client.code}</TableCell>
                  <TableCell>{client.businessName}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatCuit(client.cuit) || '-'}
                  </TableCell>
                  <TableCell>{client.city || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={client.isActive ? 'default' : 'secondary'}>
                      {client.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant={ACTION_BUTTON_CONFIG.edit.variant}
                        size={ACTION_BUTTON_CONFIG.edit.size}
                        onClick={() => onEdit(client)}
                        title={ACTION_BUTTON_CONFIG.edit.title}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={ACTION_BUTTON_CONFIG.delete.variant}
                        size={ACTION_BUTTON_CONFIG.delete.size}
                        onClick={() => setClientToDelete(client)}
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

      <AlertDialog open={!!clientToDelete} onOpenChange={() => setClientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el cliente <strong>{clientToDelete?.businessName}</strong>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}








