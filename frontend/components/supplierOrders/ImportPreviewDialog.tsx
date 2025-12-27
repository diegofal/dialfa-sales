import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, AlertCircle, XCircle, Download } from 'lucide-react';
import { ImportResult, MatchedArticle } from '@/lib/services/proformaImport/types';
import { useCreateSupplierOrder } from '@/lib/hooks/useSupplierOrders';
import { toast } from 'sonner';
import { calculateWeightedAvgSales, calculateEstimatedSaleTime } from '@/lib/utils/salesCalculations';

interface ImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importResult: ImportResult | null;
}

export function ImportPreviewDialog({
  open,
  onOpenChange,
  importResult,
}: ImportPreviewDialogProps) {
  const router = useRouter();
  const createOrderMutation = useCreateSupplierOrder({ silent: true });
  const [isCreating, setIsCreating] = useState(false);

  if (!importResult) {
    return null;
  }

  const matchedItems = importResult.items.filter((item) => item.confidence >= 70);
  const unmatchedItems = importResult.items.filter((item) => item.confidence < 70);

  const handleImportMatched = async () => {
    if (matchedItems.length === 0) {
      toast.error('No hay artículos para importar');
      return;
    }

    setIsCreating(true);

    try {
      // Create supplier order with matched items
      const orderData = {
        items: matchedItems.map((item) => {
          // Calculate sales metrics from article
          const avgMonthlySales = calculateWeightedAvgSales(item.article!.salesTrend || []);
          const estimatedSaleTime = calculateEstimatedSaleTime(
            item.extractedItem.quantity, 
            avgMonthlySales
          );

          return {
            articleId: item.article!.id,
            articleCode: item.article!.code,
            articleDescription: item.article!.description,
            quantity: item.extractedItem.quantity,
            currentStock: item.article!.stock,
            minimumStock: item.article!.minimumStock,
            avgMonthlySales,
            estimatedSaleTime: isFinite(estimatedSaleTime) ? estimatedSaleTime : undefined,
            // Valorización
            unitWeight: item.unitWeight,
            proformaUnitPrice: item.proformaUnitPrice,
            proformaTotalPrice: item.proformaTotalPrice,
            dbUnitPrice: item.dbUnitPrice,
            dbTotalPrice: item.dbTotalPrice,
            marginAbsolute: item.marginAbsolute,
            marginPercent: item.marginPercent,
          };
        }),
      };

      const result = await createOrderMutation.mutateAsync(orderData);

      if (result.success) {
        toast.success(
          `Pedido ${result.data.orderNumber} creado con ${matchedItems.length} artículos`
        );
        onOpenChange(false);
        router.push(`/dashboard/supplier-orders/${result.data.id}`);
      }
    } catch (error) {
      toast.error('Error al crear el pedido');
      console.error('Error creating order:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleExportToCSV = () => {
    if (!importResult) return;

    // Create CSV content
    const headers = [
      'Estado',
      'Descripción Extraída',
      'Cantidad',
      'Tamaño',
      'Peso Unit. (kg)',
      'P.Unit Proforma (USD)',
      'Total Proforma (USD)',
      'P.Unit DB (USD)',
      'Total DB (USD)',
      'Margen USD',
      'Margen %',
      'Tipo Detectado',
      'Serie Detectada',
      'Espesor Detectado',
      'Size Normalizado',
      'Matching Key',
      'Artículo Mapeado Código',
      'Artículo Mapeado Descripción',
      'Artículo Type',
      'Artículo Series',
      'Artículo Thickness',
      'Artículo Size',
      'Confianza',
      'Razón No-Match',
    ];

    const rows = importResult.items.map((item) => {
      const estado = item.confidence >= 70 ? 'MATCH' : 'NO_MATCH';
      return [
        estado,
        `"${item.extractedItem.description}"`,
        item.extractedItem.quantity,
        `"${item.extractedItem.size}"`,
        item.unitWeight || 0,
        item.proformaUnitPrice?.toFixed(2) || '',
        item.proformaTotalPrice?.toFixed(2) || '',
        item.dbUnitPrice?.toFixed(2) || '',
        item.dbTotalPrice?.toFixed(2) || '',
        item.marginAbsolute?.toFixed(2) || '',
        item.marginPercent?.toFixed(2) || '',
        `"${item.debugInfo?.extractedType || ''}"`,
        `"${item.debugInfo?.extractedSeries || ''}"`,
        `"${item.debugInfo?.extractedThickness || ''}"`,
        `"${item.debugInfo?.extractedSize || ''}"`,
        `"${item.matchingKey || ''}"`,
        item.article?.code || '',
        `"${item.article?.description || ''}"`,
        `"${item.article?.type || ''}"`,
        item.article?.series || '',
        `"${item.article?.thickness || ''}"`,
        `"${item.article?.size || ''}"`,
        item.confidence,
        `"${item.debugInfo?.noMatchReason || ''}"`,
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    // Create and download file
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `matching-results-${importResult.proforma.proformaNumber}-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Resultados exportados a CSV');
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 70) {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {confidence}%
        </Badge>
      );
    } else if (confidence >= 50) {
      return (
        <Badge variant="secondary">
          <AlertCircle className="h-3 w-3 mr-1" />
          {confidence}%
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Sin match
        </Badge>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[98vw] !w-[1800px] max-h-[98vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Vista Previa de Importación</DialogTitle>
              <DialogDescription>
                Proforma: {importResult.proforma.proformaNumber} • Proveedor:{' '}
                {importResult.proforma.supplier}
              </DialogDescription>
            </div>
            <Button onClick={handleExportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-5 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {importResult.summary.matched}
              </div>
              <div className="text-sm text-green-600">Artículos Mapeados</div>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="text-2xl font-bold text-amber-700">
                {importResult.summary.needsReview}
              </div>
              <div className="text-sm text-amber-600">Requieren Revisión</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-700">
                {importResult.summary.unmatched}
              </div>
              <div className="text-sm text-red-600">Sin Mapear</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">
                ${importResult.items.reduce((sum, item) => sum + item.proformaTotalPrice, 0).toFixed(2)}
              </div>
              <div className="text-sm text-blue-600">Total Proforma</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">
                ${matchedItems.reduce((sum, item) => sum + (item.dbTotalPrice || 0), 0).toFixed(2)}
              </div>
              <div className="text-sm text-purple-600">Total DB (Mapeados)</div>
            </div>
          </div>

          {/* Matched Items */}
          {matchedItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Artículos Mapeados ({matchedItems.length})
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[250px]">Descripción Extraída</TableHead>
                        <TableHead className="text-right w-[80px]">Cant.</TableHead>
                        <TableHead className="w-[100px]">Tamaño</TableHead>
                        <TableHead className="text-right w-[90px]">Peso Unit.</TableHead>
                        <TableHead className="text-right w-[100px]">P.U. Proforma</TableHead>
                        <TableHead className="text-right w-[110px]">Total Proforma</TableHead>
                        <TableHead className="text-right w-[100px]">P.U. DB</TableHead>
                        <TableHead className="text-right w-[110px]">Total DB</TableHead>
                        <TableHead className="text-right w-[100px]">Margen USD</TableHead>
                        <TableHead className="text-right w-[100px]">Margen %</TableHead>
                        <TableHead className="w-[120px]">Código</TableHead>
                        <TableHead className="text-center w-[100px]">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchedItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="w-[250px] text-sm">
                            {item.extractedItem.description}
                          </TableCell>
                          <TableCell className="text-right font-semibold w-[80px]">
                            {item.extractedItem.quantity}
                          </TableCell>
                          <TableCell className="font-mono text-sm w-[100px]">
                            {item.extractedItem.size}
                          </TableCell>
                          <TableCell className="text-right text-sm w-[90px]">
                            {item.unitWeight > 0 ? `${item.unitWeight.toFixed(2)} kg` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium w-[100px]">
                            ${item.proformaUnitPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium w-[110px]">
                            ${item.proformaTotalPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium w-[100px]">
                            {item.dbUnitPrice ? `$${item.dbUnitPrice.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium w-[110px]">
                            {item.dbTotalPrice ? `$${item.dbTotalPrice.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className={`text-right font-semibold w-[100px] ${
                            item.marginAbsolute && item.marginAbsolute > 0 
                              ? 'text-green-600' 
                              : item.marginAbsolute && item.marginAbsolute < 0 
                              ? 'text-red-600' 
                              : ''
                          }`}>
                            {item.marginAbsolute ? `$${item.marginAbsolute.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className={`text-right font-semibold w-[100px] ${
                            item.marginPercent && item.marginPercent > 0 
                              ? 'text-green-600' 
                              : item.marginPercent && item.marginPercent < 0 
                              ? 'text-red-600' 
                              : ''
                          }`}>
                            {item.marginPercent ? `${item.marginPercent.toFixed(1)}%` : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm w-[120px]">
                            {item.article?.code || '-'}
                          </TableCell>
                          <TableCell className="text-center w-[100px]">
                            {getConfidenceBadge(item.confidence)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* Unmatched Items */}
          {unmatchedItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                Artículos Sin Mapear ({unmatchedItems.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                Estos artículos no se importarán. Puedes agregarlos manualmente después.
              </p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Descripción Extraída</TableHead>
                      <TableHead className="text-right w-[80px]">Cant.</TableHead>
                      <TableHead className="w-[100px]">Tamaño</TableHead>
                      <TableHead className="text-right w-[90px]">Peso Unit.</TableHead>
                      <TableHead className="text-right w-[100px]">P.U. Proforma</TableHead>
                      <TableHead className="text-right w-[110px]">Total Proforma</TableHead>
                      <TableHead className="text-right w-[120px]">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="w-[300px]">
                          <div className="space-y-1">
                            <div className="text-sm">
                              {item.extractedItem.description}
                            </div>
                            {item.debugInfo && (
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                <div>Tipo: {item.debugInfo.extractedType || '(no detectado)'}</div>
                                <div>Espesor: {item.debugInfo.extractedThickness}</div>
                                <div>Size normalizado: {item.debugInfo.extractedSize}</div>
                                {item.debugInfo.noMatchReason && (
                                  <div className="text-amber-600 font-medium mt-1">
                                    ⚠ {item.debugInfo.noMatchReason}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold w-[80px]">
                          {item.extractedItem.quantity}
                        </TableCell>
                        <TableCell className="font-mono text-sm w-[100px]">
                          {item.extractedItem.size || '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm w-[90px]">
                          {item.unitWeight > 0 ? `${item.unitWeight.toFixed(2)} kg` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium w-[100px]">
                          ${item.proformaUnitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium w-[110px]">
                          ${item.proformaTotalPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right w-[120px]">
                          {getConfidenceBadge(item.confidence)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancelar
          </Button>
          <Button
            onClick={handleImportMatched}
            disabled={matchedItems.length === 0 || isCreating}
          >
            {isCreating
              ? 'Creando Pedido...'
              : `Importar ${matchedItems.length} Artículo${matchedItems.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

