'use client';

import { Article } from '@/types/article';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClickableTableRow } from '@/components/ui/clickable-table-row';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Package } from 'lucide-react';
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
import { ACTION_BUTTON_CONFIG } from '@/lib/constants/tableActions';
import { useState } from 'react';
import StockAdjustDialog from './StockAdjustDialog';
import { useAuthStore } from '@/store/authStore';

interface ArticlesTableProps {
  articles: Article[];
  onEdit: (article: Article) => void;
  onDelete: (id: number) => void;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
}

export function ArticlesTable({ articles, onEdit, onDelete, currentSortBy, currentSortDescending, onSort }: ArticlesTableProps) {
  const [adjustingArticle, setAdjustingArticle] = useState<Article | null>(null);
  const { isAdmin } = useAuthStore();

  const canEdit = isAdmin();

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
            <SortableTableHead sortKey="Code" currentSortBy={currentSortBy} currentSortDescending={currentSortDescending} onSort={onSort}>
              Código
            </SortableTableHead>
            <SortableTableHead sortKey="Description" currentSortBy={currentSortBy} currentSortDescending={currentSortDescending} onSort={onSort}>
              Descripción
            </SortableTableHead>
            <SortableTableHead>Categoría</SortableTableHead>
            <SortableTableHead sortKey="UnitPrice" currentSortBy={currentSortBy} currentSortDescending={currentSortDescending} onSort={onSort} align="right">
              Precio
            </SortableTableHead>
            <SortableTableHead sortKey="Stock" currentSortBy={currentSortBy} currentSortDescending={currentSortDescending} onSort={onSort} align="right">
              Stock
            </SortableTableHead>
            <SortableTableHead sortKey="MinimumStock" currentSortBy={currentSortBy} currentSortDescending={currentSortDescending} onSort={onSort} align="right">
              Stock Mín.
            </SortableTableHead>
            <SortableTableHead>Estado</SortableTableHead>
            <SortableTableHead align="right">Acciones</SortableTableHead>
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
              <ClickableTableRow
                key={article.id}
                onRowClick={() => canEdit && onEdit(article)}
                aria-label={`${canEdit ? 'Editar' : 'Ver'} artículo ${article.code} - ${article.description}`}
                className={!canEdit ? 'cursor-default' : ''}
              >
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
                    {/* Todos pueden ajustar stock */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAdjustingArticle(article);
                      }}
                      title="Ajustar Stock"
                    >
                      <Package className="h-4 w-4" />
                    </Button>

                    {/* Solo admins pueden editar */}
                    {canEdit && (
                      <Button
                        variant={ACTION_BUTTON_CONFIG.edit.variant}
                        size={ACTION_BUTTON_CONFIG.edit.size}
                        onClick={() => onEdit(article)}
                        title={ACTION_BUTTON_CONFIG.edit.title}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Solo admins pueden eliminar */}
                    {canEdit && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant={ACTION_BUTTON_CONFIG.delete.variant}
                            size={ACTION_BUTTON_CONFIG.delete.size}
                            title={ACTION_BUTTON_CONFIG.delete.title}
                          >
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
                    )}
                  </div>
                </TableCell>
              </ClickableTableRow>
            ))
          )}
        </TableBody>
      </Table>

      {adjustingArticle && (
        <StockAdjustDialog
          isOpen={!!adjustingArticle}
          onClose={() => setAdjustingArticle(null)}
          articleId={adjustingArticle.id}
          articleCode={adjustingArticle.code}
          articleDescription={adjustingArticle.description}
          currentStock={adjustingArticle.stock}
        />
      )}
    </div>
  );
}





