'use client';

import { Loader2 } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ArticleForm } from '@/components/articles/ArticleForm';
import { ArticleDetailHeader } from '@/components/articles/detail/ArticleDetailHeader';
import { ArticleHeroStats } from '@/components/articles/detail/ArticleHeroStats';
import { ArticleResumenTab } from '@/components/articles/detail/ArticleResumenTab';
import { ArticleSalesHistoryTab } from '@/components/articles/detail/ArticleSalesHistoryTab';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useArticle, useUpdateArticle } from '@/lib/hooks/domain/useArticles';
import { ArticleFormData } from '@/types/article';

export default function ArticleDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const articleId = parseInt((params?.id as string) ?? '0', 10);

  const initialTab = searchParams.get('tab') === 'edit' ? 'edit' : 'resumen';
  const [tab, setTab] = useState<string>(initialTab);

  const { data: article, isLoading, isError } = useArticle(articleId);
  const updateMutation = useUpdateArticle();

  const handleEditSubmit = async (data: ArticleFormData) => {
    if (!article) return;
    await updateMutation.mutateAsync({ id: article.id, data });
    setTab('resumen');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No se pudo cargar el artículo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ArticleDetailHeader article={article} onEditClick={() => setTab('edit')} />

      <ArticleHeroStats article={article} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="edit">Editar</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <ArticleResumenTab article={article} />
        </TabsContent>

        <TabsContent value="ventas" className="mt-4">
          <ArticleSalesHistoryTab articleId={article.id} />
        </TabsContent>

        <TabsContent value="edit" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <ArticleForm
                article={article}
                onSubmit={handleEditSubmit}
                onCancel={() => setTab('resumen')}
                isSubmitting={updateMutation.isPending}
                submitLabel="Guardar cambios"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
