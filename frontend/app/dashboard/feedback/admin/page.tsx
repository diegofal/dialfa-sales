'use client';

import {
  Bug,
  Lightbulb,
  Sparkles,
  MessageSquare,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFeedback, useUpdateFeedback, useDeleteFeedback } from '@/lib/hooks/domain/useFeedback';
import { useAuthStore } from '@/store/authStore';
import { Feedback, FeedbackType, FeedbackStatus, FeedbackPriority } from '@/types/feedback';

const feedbackTypes: {
  value: FeedbackType;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { value: 'bug', label: 'Error', icon: Bug, color: 'bg-red-500' },
  { value: 'improvement', label: 'Mejora', icon: Lightbulb, color: 'bg-yellow-500' },
  { value: 'feature', label: 'Nueva Funcionalidad', icon: Sparkles, color: 'bg-blue-500' },
  { value: 'other', label: 'Otro', icon: MessageSquare, color: 'bg-gray-500' },
];

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  'in-review': 'En Revisión',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  'in-review': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  dismissed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

const priorityLabels: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export default function AdminFeedbackPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<FeedbackType | 'all'>('all');

  const [updateData, setUpdateData] = useState({
    status: '' as FeedbackStatus,
    priority: 'none' as FeedbackPriority | 'none',
    adminNotes: '',
  });

  // Query feedback list with filters
  const { data, isLoading, refetch } = useFeedback({
    status: filterStatus === 'all' ? undefined : filterStatus,
    type: filterType === 'all' ? undefined : filterType,
  });

  const updateMutation = useUpdateFeedback();
  const deleteMutation = useDeleteFeedback();

  const feedbacks = data?.data || [];

  useEffect(() => {
    refetch();
  }, [filterStatus, filterType, refetch]);

  if (!isAdmin) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="text-destructive h-5 w-5" />
              Acceso Denegado
            </CardTitle>
            <CardDescription>No tienes permisos para acceder a esta página</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleOpenDialog = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setUpdateData({
      status: feedback.status,
      priority: feedback.priority || 'none',
      adminNotes: feedback.adminNotes || '',
    });
    setDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedFeedback) return;

    const priorityValue =
      updateData.priority === 'none' ? null : (updateData.priority as FeedbackPriority);

    updateMutation.mutate(
      {
        id: selectedFeedback.id,
        data: {
          status: updateData.status,
          priority: priorityValue,
          adminNotes: updateData.adminNotes || null,
        },
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
        },
      }
    );
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este feedback?')) return;

    deleteMutation.mutate(id);
  };

  const filteredFeedbacks = feedbacks;

  const stats = {
    total: feedbacks.length,
    pending: feedbacks.filter((f) => f.status === 'pending').length,
    inReview: feedbacks.filter((f) => f.status === 'in-review').length,
    resolved: feedbacks.filter((f) => f.status === 'resolved').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administración de Feedback</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona todos los reportes y sugerencias de los usuarios
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">En Revisión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inReview}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Resueltos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Todos los Feedbacks</CardTitle>
            <div className="flex gap-2">
              <Select
                value={filterStatus}
                onValueChange={(value) => setFilterStatus(value as FeedbackStatus | 'all')}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in-review">En Revisión</SelectItem>
                  <SelectItem value="resolved">Resuelto</SelectItem>
                  <SelectItem value="dismissed">Descartado</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filterType}
                onValueChange={(value) => setFilterType(value as FeedbackType | 'all')}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="bug">Error</SelectItem>
                  <SelectItem value="improvement">Mejora</SelectItem>
                  <SelectItem value="feature">Funcionalidad</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No hay feedback para mostrar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFeedbacks.map((feedback) => {
                const typeInfo = feedbackTypes.find((t) => t.value === feedback.type);
                const TypeIcon = typeInfo?.icon || MessageSquare;

                return (
                  <div
                    key={feedback.id}
                    className="hover:bg-accent/50 cursor-pointer rounded-lg border p-4 transition-colors"
                    onClick={() => handleOpenDialog(feedback)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-1 items-start gap-3">
                        <div className={`rounded-lg p-2 ${typeInfo?.color} text-white`}>
                          <TypeIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{feedback.subject}</h3>
                            <Badge variant="outline" className={statusColors[feedback.status]}>
                              {statusLabels[feedback.status]}
                            </Badge>
                            {feedback.priority && (
                              <Badge
                                variant="outline"
                                className={priorityColors[feedback.priority]}
                              >
                                {priorityLabels[feedback.priority]}
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">
                            {feedback.description}
                          </p>
                          <div className="text-muted-foreground flex items-center gap-4 text-xs">
                            <span className="font-medium">{feedback.fullName}</span>
                            <span>•</span>
                            <span>
                              {new Date(feedback.createdAt).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(feedback.id);
                        }}
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar Feedback</DialogTitle>
            <DialogDescription>
              Actualiza el estado, prioridad y agrega notas administrativas
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="font-semibold">{selectedFeedback.subject}</h4>
                  <Badge variant="outline">
                    {feedbackTypes.find((t) => t.value === selectedFeedback.type)?.label}
                  </Badge>
                </div>
                <p className="mb-3 text-sm">{selectedFeedback.description}</p>
                <div className="text-muted-foreground text-xs">
                  <p>
                    Reportado por: {selectedFeedback.fullName} ({selectedFeedback.username})
                  </p>
                  <p>
                    Fecha:{' '}
                    {new Date(selectedFeedback.createdAt).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={updateData.status}
                  onValueChange={(value) =>
                    setUpdateData({ ...updateData, status: value as FeedbackStatus })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="in-review">En Revisión</SelectItem>
                    <SelectItem value="resolved">Resuelto</SelectItem>
                    <SelectItem value="dismissed">Descartado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Prioridad</Label>
                <Select
                  value={updateData.priority}
                  onValueChange={(value) =>
                    setUpdateData({ ...updateData, priority: value as FeedbackPriority | 'none' })
                  }
                >
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Seleccionar prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin prioridad</SelectItem>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNotes">Notas Administrativas</Label>
                <Textarea
                  id="adminNotes"
                  placeholder="Agrega notas visibles para el usuario..."
                  value={updateData.adminNotes}
                  onChange={(e) => setUpdateData({ ...updateData, adminNotes: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
