'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateArticle, useUpdateArticle } from '@/lib/hooks/domain/useArticles';
import { Article, ArticleFormData } from '@/types/article';
import { ArticleForm } from './ArticleForm';

interface ArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article?: Article | null;
}

export function ArticleDialog({ open, onOpenChange, article }: ArticleDialogProps) {
  const isEditing = !!article;
  const createMutation = useCreateArticle();
  const updateMutation = useUpdateArticle();

  const handleSubmit = async (data: ArticleFormData) => {
    if (isEditing) {
      await updateMutation.mutateAsync({ id: article.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Artículo' : 'Nuevo Artículo'}</DialogTitle>
        </DialogHeader>
        <ArticleForm
          article={article}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
