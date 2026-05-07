'use client';

import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/constants/routes';
import { Article } from '@/types/article';
import { StockStatusBadge } from '../StockStatusBadge';

interface ArticleDetailHeaderProps {
  article: Article;
  onEditClick?: () => void;
}

export function ArticleDetailHeader({ article, onEditClick }: ArticleDetailHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        href={ROUTES.ARTICLES}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a artículos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-mono text-2xl font-bold tracking-tight">{article.code}</h1>
          <p className="text-foreground/80 text-lg">{article.description}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline">{article.categoryName}</Badge>
            <StockStatusBadge status={article.stockStatus} />
            {article.isDiscontinued && (
              <Badge variant="destructive" className="text-xs">
                Descontinuado
              </Badge>
            )}
            {article.abcClass && (
              <Badge
                variant="outline"
                className={
                  article.abcClass === 'A'
                    ? 'border-green-500 text-green-700 dark:text-green-400'
                    : article.abcClass === 'B'
                      ? 'border-blue-500 text-blue-700 dark:text-blue-400'
                      : 'border-gray-500 text-gray-700 dark:text-gray-400'
                }
              >
                ABC: {article.abcClass}
              </Badge>
            )}
          </div>
        </div>

        {onEditClick && (
          <Button variant="outline" onClick={onEditClick}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        )}
      </div>
    </div>
  );
}
