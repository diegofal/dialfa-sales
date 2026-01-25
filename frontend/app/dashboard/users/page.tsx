'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import UserDialog from '@/components/users/UserDialog';
import UsersTable from '@/components/users/UsersTable';
import { useUsers, useDeactivateUser } from '@/lib/hooks/domain/useUsers';
import { User } from '@/types/user';

export default function UsersPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);

  const { data, isLoading } = useUsers();
  const deactivateUserMutation = useDeactivateUser();

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    setIsDialogOpen(true);
  };

  const handleDeactivate = (user: User) => {
    setDeactivatingUser(user);
  };

  const confirmDeactivate = () => {
    if (deactivatingUser) {
      deactivateUserMutation.mutate(deactivatingUser.id, {
        onSuccess: () => {
          toast.success('Usuario desactivado correctamente');
          setDeactivatingUser(null);
        },
        onError: () => toast.error('Error al desactivar usuario'),
      });
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h2>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Usuario
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div>Cargando usuarios...</div>
        ) : (
          <UsersTable users={data?.data || []} onEdit={handleEdit} onDelete={handleDeactivate} />
        )}
      </div>

      <UserDialog user={editingUser} isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />

      <AlertDialog open={!!deactivatingUser} onOpenChange={() => setDeactivatingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción desactivará al usuario &quot;{deactivatingUser?.username}&quot;. No podrá
              volver a ingresar al sistema hasta que sea reactivado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
