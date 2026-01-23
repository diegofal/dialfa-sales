'use client';

import { Bug, Lightbulb, Sparkles, MessageSquare, Send, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { FeedbackType } from '@/types/feedback';

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

export default function FeedbackPage() {
  const { feedbacks, isLoading, createFeedback, fetchFeedbacks } = useFeedback();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: 'bug' as FeedbackType,
    subject: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject.trim() || !formData.description.trim()) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setSubmitting(true);
    try {
      await createFeedback(formData);
      toast.success('¡Feedback enviado exitosamente!');
      setFormData({ type: 'bug', subject: '', description: '' });
      setShowForm(false);
      fetchFeedbacks();
    } catch (error) {
      toast.error('Error al enviar feedback');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feedback</h1>
          <p className="text-muted-foreground mt-1">
            Reporta errores, sugiere mejoras o solicita nuevas funcionalidades
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Send className="mr-2 h-4 w-4" />
            Enviar Feedback
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Feedback</CardTitle>
            <CardDescription>
              Cuéntanos qué podemos mejorar o qué problema encontraste
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as FeedbackType })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {feedbackTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Asunto</Label>
                <Input
                  id="subject"
                  placeholder="Describe brevemente el problema o sugerencia"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Proporciona más detalles sobre tu feedback..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={6}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ type: 'bug', subject: '', description: '' });
                  }}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tus Envíos</CardTitle>
          <CardDescription>Revisa el estado de tus reportes y sugerencias</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Aún no has enviado ningún feedback</p>
              <p className="mt-2 text-sm">Haz clic en &quot;Enviar Feedback&quot; para comenzar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbacks.map((feedback) => {
                const typeInfo = feedbackTypes.find((t) => t.value === feedback.type);
                const TypeIcon = typeInfo?.icon || MessageSquare;

                return (
                  <div
                    key={feedback.id}
                    className="hover:bg-accent/50 rounded-lg border p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-1 items-start gap-3">
                        <div className={`rounded-lg p-2 ${typeInfo?.color} text-white`}>
                          <TypeIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <h3 className="truncate font-semibold">{feedback.subject}</h3>
                            <Badge variant="outline" className={statusColors[feedback.status]}>
                              {statusLabels[feedback.status]}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">
                            {feedback.description}
                          </p>
                          <div className="text-muted-foreground flex items-center gap-4 text-xs">
                            <span>
                              {new Date(feedback.createdAt).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </span>
                            {feedback.priority && (
                              <Badge variant="outline" className="text-xs">
                                Prioridad: {feedback.priority}
                              </Badge>
                            )}
                          </div>
                          {feedback.adminNotes && (
                            <div className="bg-muted mt-3 rounded-md p-3">
                              <p className="mb-1 text-xs font-semibold">Nota del administrador:</p>
                              <p className="text-sm">{feedback.adminNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
