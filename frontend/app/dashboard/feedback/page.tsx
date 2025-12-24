'use client';

import { useState } from 'react';
import { useFeedback } from '@/lib/hooks/useFeedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FeedbackType } from '@/types/feedback';
import { Bug, Lightbulb, Sparkles, MessageSquare, Send, Loader2 } from 'lucide-react';

const feedbackTypes: { value: FeedbackType; label: string; icon: any; color: string }[] = [
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

  const selectedType = feedbackTypes.find(t => t.value === formData.type);

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
                  onValueChange={(value) => setFormData({ ...formData, type: value as FeedbackType })}
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

              <div className="flex gap-2 justify-end">
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
          <CardDescription>
            Revisa el estado de tus reportes y sugerencias
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aún no has enviado ningún feedback</p>
              <p className="text-sm mt-2">
                Haz clic en "Enviar Feedback" para comenzar
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbacks.map((feedback) => {
                const typeInfo = feedbackTypes.find(t => t.value === feedback.type);
                const TypeIcon = typeInfo?.icon || MessageSquare;
                
                return (
                  <div
                    key={feedback.id}
                    className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${typeInfo?.color} text-white`}>
                          <TypeIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{feedback.subject}</h3>
                            <Badge variant="outline" className={statusColors[feedback.status]}>
                              {statusLabels[feedback.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {feedback.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                            <div className="mt-3 p-3 bg-muted rounded-md">
                              <p className="text-xs font-semibold mb-1">Nota del administrador:</p>
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

