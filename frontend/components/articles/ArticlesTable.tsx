'use client';

import { Article } from '@/types/article';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ArticlesTableProps {
  articles: Article[];
  onEdit: (article: Article) => void;
  onDelete: (id: number) => void;
}

export function ArticlesTable({ articles, onEdit, onDelete }: ArticlesTableProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(price);
  };

  const getStockBadge = (article: Article) => {
    if (article.isLowStock) {
      return <Badge variant="destructive">Stock Bajo</Badge>;
    }
    if (article.stock === 0) {
      return <Badge variant="secondary">Sin Stock</Badge>;
    }
    return <Badge variant="default">Disponible</Badge>;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Stock Mín.</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No hay artículos para mostrar
              </TableCell>
            </TableRow>
          ) : (
            articles.map((article) => (
              <TableRow key={article.id}>
                <TableCell className="font-medium">{article.code}</TableCell>
                <TableCell>
                  <div className="max-w-md">
                    <p className="truncate">{article.description}</p>
                    {article.location && (
                      <p className="text-xs text-muted-foreground">📍 {article.location}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{article.categoryName}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatPrice(article.unitPrice)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={article.isLowStock ? 'text-red-600 font-semibold' : ''}>
                    {article.stock}
                  </span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {article.minimumStock}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {getStockBadge(article)}
                    {article.isDiscontinued && (
                      <Badge variant="outline" className="text-xs">
                        Descontinuado
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(article)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará el artículo &quot;{article.description}&quot;. Los datos
                            permanecerán en el sistema pero no se mostrarán.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(article.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}




