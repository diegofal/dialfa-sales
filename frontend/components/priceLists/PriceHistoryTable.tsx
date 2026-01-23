'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Calendar, User, Undo2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePriceHistory } from '@/lib/hooks/usePriceHistory';
import { useRevertPrice, useUndoLastChange, useRevertBatch } from '@/lib/hooks/usePriceLists';

interface PriceHistoryTableProps {
  articleId?: number;
  categoryId?: number;
}

export function PriceHistoryTable({ articleId, categoryId }: PriceHistoryTableProps) {
  const [page, setPage] = useState(1);
  const [changeType, setChangeType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data, isLoading } = usePriceHistory({
    articleId,
    categoryId,
    changeType: changeType !== 'all' ? changeType : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit: 50,
  });

  const revertPriceMutation = useRevertPrice();
  const undoMutation = useUndoLastChange();
  const revertBatchMutation = useRevertBatch();

  const handleRevert = (historyId: number, articleCode: string) => {
    if (window.confirm(`¿Estás seguro de revertir el precio del artículo ${articleCode}?`)) {
      revertPriceMutation.mutate(historyId);
    }
  };

  const handleUndo = () => {
    if (
      window.confirm(
        '¿Deshacer el ÚLTIMO cambio realizado? Esto revertirá todos los artículos del lote más reciente.'
      )
    ) {
      undoMutation.mutate();
    }
  };

  const handleRevertBatch = (batchId: string, count: number) => {
    if (window.confirm(`¿Revertir ${count} artículos de este lote?`)) {
      revertBatchMutation.mutate(batchId);
    }
  };

  // Obtener batches únicos en la página actual
  const uniqueBatches = data?.data
    .filter((item) => item.changeBatchId)
    .reduce((acc, item) => {
      if (!acc.has(item.changeBatchId!)) {
        acc.set(item.changeBatchId!, {
          batchId: item.changeBatchId!,
          count: 1,
          firstDate: item.createdAt,
        });
      } else {
        const batch = acc.get(item.changeBatchId!);
        batch!.count++;
      }
      return acc;
    }, new Map<string, { batchId: string; count: number; firstDate: string }>());

  const batchesInView = uniqueBatches ? Array.from(uniqueBatches.values()) : [];

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      manual: 'Manual',
      csv_import: 'Importación CSV',
      bulk_update: 'Actualización Masiva',
      price_revert: 'Reversión',
    };
    return labels[type] || type;
  };

  const getChangeTypeVariant = (
    type: string
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      manual: 'default',
      csv_import: 'secondary',
      bulk_update: 'outline',
      price_revert: 'destructive',
    };
    return variants[type] || 'outline';
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            onClick={handleUndo}
            disabled={undoMutation.isPending || isLoading || !data || data.data.length === 0}
            variant="default"
            size="sm"
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Deshacer Último Cambio
          </Button>
        </div>

        {batchesInView.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {batchesInView.length} lote(s) en pantalla
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Tipo de Cambio</Label>
          <Select value={changeType} onValueChange={setChangeType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="csv_import">Importación CSV</SelectItem>
              <SelectItem value="bulk_update">Actualización Masiva</SelectItem>
              <SelectItem value="price_revert">Reversión</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fecha Desde</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label>Fecha Hasta</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="flex gap-4 text-sm">
          <Badge variant="secondary">Total: {data.pagination.total} cambios</Badge>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-muted-foreground">Cargando historial...</p>
          </div>
        ) : data && data.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Fecha</TableHead>
                <TableHead className="w-[120px]">Batch ID</TableHead>
                <TableHead className="w-[120px]">Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Precio Anterior</TableHead>
                <TableHead className="text-right">Precio Nuevo</TableHead>
                <TableHead className="text-right">Cambio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead className="w-[150px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-xs">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(item.createdAt), 'dd/MM/yyyy', { locale: es })}
                    </div>
                    <div className="text-muted-foreground">
                      {format(new Date(item.createdAt), 'HH:mm')}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.changeBatchId ? (
                      <div className="font-mono">
                        <div className="w-[110px] truncate" title={item.changeBatchId}>
                          {item.changeBatchId.substring(0, 8)}...
                        </div>
                        {uniqueBatches?.has(item.changeBatchId) && (
                          <Badge variant="outline" className="mt-1 px-1 py-0 text-[9px]">
                            {uniqueBatches.get(item.changeBatchId)!.count} items
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.articleCode}</TableCell>
                  <TableCell className="text-sm">{item.articleDescription}</TableCell>
                  <TableCell className="text-right">${item.oldPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${item.newPrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.priceChange > 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-600">
                            +${item.priceChange.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <span className="font-medium text-red-600">
                            ${item.priceChange.toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-muted-foreground text-right text-xs">
                      {item.priceChangePercent > 0 ? '+' : ''}
                      {item.priceChangePercent.toFixed(1)}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getChangeTypeVariant(item.changeType)}>
                      {getChangeTypeLabel(item.changeType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {item.changedByName || 'Sistema'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevert(item.id, item.articleCode || '')}
                        disabled={revertPriceMutation.isPending}
                        title="Revertir este artículo"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                      {item.changeBatchId && uniqueBatches?.has(item.changeBatchId) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleRevertBatch(
                              item.changeBatchId!,
                              uniqueBatches.get(item.changeBatchId!)!.count
                            )
                          }
                          disabled={revertBatchMutation.isPending}
                          title="Revertir todo el lote"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-48 items-center justify-center">
            <p className="text-muted-foreground">No hay cambios registrados</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <Pagination
          totalCount={data.pagination.total}
          currentPage={page}
          pageSize={data.pagination.limit}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
