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
import { Pencil, Trash2, Package, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
import { SparklineWithTooltip } from '@/components/ui/sparkline';
import { Checkbox } from '@/components/ui/checkbox';

interface ArticlesTableProps {
  articles: Article[];
  onEdit: (article: Article) => void;
  onDelete: (id: number) => void;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
  // Supplier order mode
  selectionMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (article: Article) => void;
}

export function ArticlesTable({ 
  articles, 
  onEdit, 
  onDelete, 
  currentSortBy, 
  currentSortDescending, 
  onSort,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
}: ArticlesTableProps) {
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

  // Calculate trend direction
  const calculateTrend = (salesTrend: number[] | undefined) => {
    if (!salesTrend || salesTrend.length < 2) return 'none';
    
    const midPoint = Math.floor(salesTrend.length / 2);
    const firstHalf = salesTrend.slice(0, midPoint);
    const secondHalf = salesTrend.slice(midPoint);
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (avgFirst === 0 && avgSecond === 0) return 'none';
    if (avgFirst === 0) return 'increasing';
    
    const changePercent = ((avgSecond - avgFirst) / avgFirst) * 100;
    
    if (changePercent > 20) return 'increasing';
    if (changePercent < -20) return 'decreasing';
    return 'stable';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />;
      case 'decreasing':
        return <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />;
      case 'stable':
        return <Minus className="h-3 w-3 text-blue-600 dark:text-blue-400" />;
      default:
        return <Minus className="h-3 w-3 text-gray-600 dark:text-gray-400" />;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectionMode && (
              <SortableTableHead className="w-12">
                <span className="sr-only">Seleccionar</span>
              </SortableTableHead>
            )}
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
            <SortableTableHead>Tendencia</SortableTableHead>
            <SortableTableHead>ABC</SortableTableHead>
            <SortableTableHead>Última Venta</SortableTableHead>
            <SortableTableHead>Estado</SortableTableHead>
            <SortableTableHead align="right">Acciones</SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
                No hay artículos para mostrar
              </TableCell>
            </TableRow>
          ) : (
            articles.map((article) => (
              <ClickableTableRow
                key={article.id}
                onRowClick={() => {
                  if (selectionMode && onToggleSelect) {
                    onToggleSelect(article);
                  } else if (canEdit) {
                    onEdit(article);
                  }
                }}
                aria-label={`${canEdit ? 'Editar' : 'Ver'} artículo ${article.code} - ${article.description}`}
                className={`${!canEdit && !selectionMode ? 'cursor-default' : ''} ${
                  selectionMode && selectedIds.has(article.id) ? 'bg-primary/10' : ''
                }`}
              >
                {selectionMode && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(article.id)}
                      onCheckedChange={() => onToggleSelect && onToggleSelect(article)}
                    />
                  </TableCell>
                )}
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
                  {article.salesTrend && article.salesTrend.length > 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        {getTrendIcon(calculateTrend(article.salesTrend))}
                        <span className="text-xs text-muted-foreground">
                          {(article.salesTrend.reduce((a, b) => a + b, 0) / article.salesTrend.length).toFixed(1)}/mes
                        </span>
                      </div>
                      <SparklineWithTooltip
                        data={article.salesTrend}
                        labels={article.salesTrendLabels}
                        width={Math.min(180, Math.max(80, article.salesTrend.length * 10))}
                        height={30}
                        color={
                          calculateTrend(article.salesTrend) === 'increasing'
                            ? 'rgb(34, 197, 94)' // green
                            : calculateTrend(article.salesTrend) === 'decreasing'
                            ? 'rgb(239, 68, 68)' // red
                            : 'rgb(59, 130, 246)' // blue
                        }
                        fillColor={
                          calculateTrend(article.salesTrend) === 'increasing'
                            ? 'rgba(34, 197, 94, 0.1)'
                            : calculateTrend(article.salesTrend) === 'decreasing'
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(59, 130, 246, 0.1)'
                        }
                        formatValue={(v) => `${v} unidades`}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin datos</span>
                  )}
                </TableCell>
                <TableCell>
                  {article.abcClass ? (
                    <Badge
                      variant={
                        article.abcClass === 'A'
                          ? 'default'
                          : article.abcClass === 'B'
                          ? 'secondary'
                          : 'outline'
                      }
                      className={
                        article.abcClass === 'A'
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : article.abcClass === 'B'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-gray-600 hover:bg-gray-700 text-white'
                      }
                    >
                      {article.abcClass}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">N/A</span>
                  )}
                </TableCell>
                <TableCell>
                  {article.lastSaleDate ? (
                    <span className="text-sm">
                      {new Date(article.lastSaleDate).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Nunca vendido</span>
                  )}
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
                    {/* Hide stock adjust and edit buttons in selection mode */}
                    {!selectionMode && (
                      <>
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
                      </>
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





