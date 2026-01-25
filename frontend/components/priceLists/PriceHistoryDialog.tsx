'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Calendar, User, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { usePriceHistory } from '@/lib/hooks/domain/usePriceHistory';
import { useRevertPrice } from '@/lib/hooks/domain/usePriceLists';

interface PriceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articleId?: number;
  categoryId?: number;
}

export function PriceHistoryDialog({
  open,
  onOpenChange,
  articleId,
  categoryId,
}: PriceHistoryDialogProps) {
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
    limit: 25,
  });

  const revertPriceMutation = useRevertPrice();

  const handleRevert = (historyId: number, articleCode: string) => {
    if (window.confirm(`¿Estás seguro de revertir el precio del artículo ${articleCode}?`)) {
      revertPriceMutation.mutate(historyId);
    }
  };

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      manual: 'Manual',
      csv_import: 'Importación CSV',
      bulk_update: 'Actualización Masiva',
    };
    return labels[type] || type;
  };

  const getChangeTypeVariant = (type: string): 'default' | 'secondary' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      manual: 'default',
      csv_import: 'secondary',
      bulk_update: 'outline',
    };
    return variants[type] || 'outline';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Historial de Cambios de Precios</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-4 border-b pb-4">
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
        <div className="flex-1 overflow-auto rounded-lg border">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-muted-foreground">Cargando historial...</p>
            </div>
          ) : data && data.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Fecha</TableHead>
                  <TableHead className="w-[120px]">Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Precio Anterior</TableHead>
                  <TableHead className="text-right">Precio Nuevo</TableHead>
                  <TableHead className="text-right">Cambio</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="w-[100px]">Acciones</TableHead>
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevert(item.id, item.articleCode || '')}
                        disabled={revertPriceMutation.isPending}
                        title="Revertir a precio anterior"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
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
      </DialogContent>
    </Dialog>
  );
}
