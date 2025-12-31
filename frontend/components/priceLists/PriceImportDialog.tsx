'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Upload, AlertCircle, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { toast } from 'sonner';

interface ImportPreviewItem {
  code: string;
  articleId?: number;
  description?: string;
  currentPrice?: number;
  costPrice?: number;
  cifPercentage?: number;
  cifValue?: number;
  categoryDiscount: number;
  effectiveDiscount: number; // El descuento que realmente se aplicó
  newPrice: number;
  discountedPrice: number; // Precio con descuento de categoría
  adjustedPrice: number; // Precio con descuento ajustado manualmente
  margin?: number;
  marginAmount?: number;
  markup?: number; // ROI sobre costo
  status: 'found' | 'not-found' | 'no-cost';
}

interface PriceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (updates: Array<{ articleId: number; newPrice: number }>) => void;
  articles: Array<{
    id: number;
    code: string;
    description: string;
    unitPrice: number;
    costPrice?: number;
    cifPercentage?: number;
    categoryDiscount: number;
  }>;
}

export function PriceImportDialog({ open, onOpenChange, onConfirm, articles }: PriceImportDialogProps) {
  const [csvData, setCsvData] = useState<ImportPreviewItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor selecciona un archivo CSV');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error('El archivo CSV está vacío o no tiene datos');
          return;
        }

        // Skip header
        const dataLines = lines.slice(1);
        
        const parsed: ImportPreviewItem[] = dataLines.map(line => {
          const [code, priceStr] = line.split(',').map(s => s.trim());
          const newPrice = parseFloat(priceStr);
          
          if (!code || isNaN(newPrice)) {
            return null;
          }

          // Buscar artículo por código
          const article = articles.find(a => a.code.toUpperCase() === code.toUpperCase());
          
          if (!article) {
            return {
              code,
              categoryDiscount: 0,
              effectiveDiscount: 0,
              newPrice,
              discountedPrice: newPrice,
              adjustedPrice: newPrice,
              status: 'not-found' as const,
            };
          }

          // Calcular precio con descuento de categoría
          const discountedPrice = newPrice * (1 - article.categoryDiscount / 100);

          // Calcular CIF: Último Precio Compra * (1 + CIF%)
          const hasCostAndCif = article.costPrice && article.costPrice > 0 && article.cifPercentage && article.cifPercentage > 0;
          const cifValue = hasCostAndCif 
            ? article.costPrice! * (1 + article.cifPercentage! / 100)
            : undefined;
          
          // Calcular margen sobre ventas: (Precio - Costo) / Precio × 100
          const marginAmount = cifValue ? discountedPrice - cifValue : undefined;
          const margin = cifValue && discountedPrice > 0
            ? (marginAmount! / discountedPrice) * 100
            : undefined;
          
          // Calcular markup (rentabilidad sobre costo): (Precio - Costo) / Costo × 100
          const markup = cifValue && cifValue > 0
            ? (marginAmount! / cifValue) * 100
            : undefined;

          return {
            code,
            articleId: article.id,
            description: article.description,
            currentPrice: article.unitPrice,
            costPrice: article.costPrice,
            cifPercentage: article.cifPercentage,
            cifValue,
            categoryDiscount: article.categoryDiscount,
            effectiveDiscount: article.categoryDiscount, // Inicialmente usa el de categoría
            newPrice,
            discountedPrice,
            adjustedPrice: discountedPrice, // Inicialmente igual al precio con descuento de categoría
            margin,
            marginAmount,
            markup,
            status: hasCostAndCif ? 'found' as const : 'no-cost' as const,
          };
        }).filter(Boolean) as ImportPreviewItem[];

        setCsvData(parsed);
        toast.success(`${parsed.length} precios cargados del CSV`);
      } catch (error) {
        toast.error('Error al procesar el archivo CSV');
        console.error(error);
      }
    };

    reader.readAsText(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDiscountChange = (value: string) => {
    const discount = parseFloat(value) || 0;
    setDiscountPercent(discount);
    
    // Si hay descuento manual, sobreescribe el de categoría; si no, usa el de categoría
    setCsvData(prev => prev.map(item => {
      const effectiveDiscount = discount > 0 ? discount : item.categoryDiscount;
      const adjustedPrice = item.newPrice * (1 - effectiveDiscount / 100);
      
      // Recalcular margen sobre ventas con CIF
      const marginAmount = item.cifValue ? adjustedPrice - item.cifValue : undefined;
      const margin = item.cifValue && adjustedPrice > 0
        ? (marginAmount! / adjustedPrice) * 100
        : undefined;
      
      // Recalcular markup (ROI sobre costo)
      const markup = item.cifValue && item.cifValue > 0
        ? (marginAmount! / item.cifValue) * 100
        : undefined;
      
      return {
        ...item,
        effectiveDiscount, // Guardar el descuento que se aplicó
        adjustedPrice,
        margin,
        marginAmount,
        markup,
      };
    }));
  };

  const handleConfirm = async () => {
    const validUpdates = csvData
      .filter(item => item.status === 'found' || item.status === 'no-cost')
      .filter(item => item.articleId)
      .map(item => ({
        articleId: item.articleId!,
        newPrice: item.adjustedPrice,
      }));

    if (validUpdates.length === 0) {
      toast.error('No hay precios válidos para actualizar');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(validUpdates);
      onOpenChange(false);
      setCsvData([]);
      setDiscountPercent(0);
    } catch (error) {
      // Error ya manejado por el mutation
    } finally {
      setIsProcessing(false);
    }
  };

  const stats = {
    total: csvData.length,
    found: csvData.filter(i => i.status === 'found' || i.status === 'no-cost').length,
    notFound: csvData.filter(i => i.status === 'not-found').length,
    noCost: csvData.filter(i => i.status === 'no-cost').length,
    avgMarkup: csvData
      .filter(i => i.markup !== undefined)
      .reduce((sum, i) => sum + i.markup!, 0) / csvData.filter(i => i.markup !== undefined).length || 0,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[98vw] !w-[1800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Precios desde CSV</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con las columnas: Codigo, NuevoDB
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          {/* Upload Section */}
          {csvData.length === 0 ? (
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className={`h-12 w-12 mx-auto mb-4 transition-colors ${
                isDragging ? 'text-primary' : 'text-muted-foreground'
              }`} />
              <div className="text-sm text-muted-foreground mb-4">
                {isDragging 
                  ? 'Suelta el archivo aquí...' 
                  : 'Arrastra un archivo CSV aquí o haz clic para seleccionar'
                }
              </div>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <Button variant="secondary" type="button" asChild>
                  <span>Seleccionar Archivo</span>
                </Button>
              </Label>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                  <div className="text-xs text-muted-foreground">Encontrados</div>
                  <div className="text-2xl font-bold text-green-600">{stats.found}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                  <div className="text-xs text-muted-foreground">No Encontrados</div>
                  <div className="text-2xl font-bold text-red-600">{stats.notFound}</div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg">
                  <div className="text-xs text-muted-foreground">Sin Últ. Precio</div>
                  <div className="text-2xl font-bold text-yellow-600">{stats.noCost}</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-lg">
                  <div className="text-xs text-muted-foreground">Markup Promedio</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.avgMarkup.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Discount Adjustment */}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label htmlFor="discount">Ajuste de Descuento (%)</Label>
                  <Input
                    id="discount"
                    type="number"
                    step="0.1"
                    value={discountPercent}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <Button variant="outline" onClick={() => handleDiscountChange('0')}>
                  Resetear
                </Button>
              </div>

              {discountPercent !== 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Se aplicará un descuento del <strong>{discountPercent}%</strong> a todos los precios, 
                    <strong> sobreescribiendo</strong> el descuento de categoría
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview Table */}
              <div className="border rounded-lg overflow-auto max-h-96">
                <TooltipProvider>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Código</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Precio Actual</TableHead>
                        <TableHead className="text-right">Nuevo Precio</TableHead>
                        <TableHead className="text-right">Precio c/ Desc</TableHead>
                        <TableHead className="text-right">Precio Final</TableHead>
                        <TableHead className="text-right">% Cambio</TableHead>
                        <TableHead className="text-right">Últ. P. Compra</TableHead>
                        <TableHead className="text-right">CIF %</TableHead>
                        <TableHead className="text-right">Valor CIF</TableHead>
                        <TableHead className="text-right">Margen $</TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span>Margen %</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="w-[280px]">
                                <div className="space-y-2">
                                  <p className="font-semibold">Margen sobre Ventas</p>
                                  <p className="text-xs">Fórmula: (Precio - Costo) / Precio × 100</p>
                                  <p className="text-xs">Indica qué % del precio de venta es ganancia. Útil para análisis financiero y comparar con estándares de la industria.</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                        <TableHead className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span>Markup %</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="w-[280px]">
                                <div className="space-y-2">
                                  <p className="font-semibold">Rentabilidad sobre Costo (ROI)</p>
                                  <p className="text-xs">Fórmula: (Precio - Costo) / Costo × 100</p>
                                  <p className="text-xs">Indica cuánto ganas por cada dólar invertido. Es la métrica clave para decidir si un precio es rentable.</p>
                                  <p className="text-xs">Ej: 590% = por cada $1 que gastas, ganas $5.90</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {csvData.map((item, idx) => {
                      // Calcular porcentaje de cambio basado en el precio final
                      const priceChange = item.currentPrice 
                        ? ((item.adjustedPrice - item.currentPrice) / item.currentPrice) * 100
                        : null;
                      
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">{item.code}</TableCell>
                          <TableCell className="text-sm">
                            {item.description || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.currentPrice ? `$${item.currentPrice.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${item.newPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            ${item.adjustedPrice.toFixed(2)}
                            {item.effectiveDiscount > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (-{item.effectiveDiscount.toFixed(1)}%)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            ${item.adjustedPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {priceChange !== null ? (
                              <span className={priceChange < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        <TableCell className="text-right">
                          {item.costPrice ? `$${item.costPrice.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {item.cifPercentage ? `${item.cifPercentage.toFixed(1)}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.cifValue ? `$${item.cifValue.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {item.marginAmount !== undefined ? (
                            <span className={item.marginAmount < 0 ? 'text-red-600' : 'text-green-600'}>
                              ${item.marginAmount.toFixed(2)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.margin !== undefined ? (
                            <div className="flex items-center justify-end gap-1">
                              {item.margin >= 30 ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : item.margin >= 15 ? (
                                <TrendingUp className="h-4 w-4 text-yellow-600" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              )}
                              <span className={
                                item.margin >= 30 ? 'text-green-600' :
                                item.margin >= 15 ? 'text-yellow-600' : 'text-red-600'
                              }>
                                {item.margin.toFixed(1)}%
                              </span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.markup !== undefined ? (
                            <div className="flex items-center justify-end gap-1">
                              {item.markup >= 100 ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : item.markup >= 50 ? (
                                <TrendingUp className="h-4 w-4 text-yellow-600" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              )}
                              <span className={
                                item.markup >= 100 ? 'text-green-600 font-semibold' :
                                item.markup >= 50 ? 'text-yellow-600 font-semibold' : 'text-red-600 font-semibold'
                              }>
                                {item.markup.toFixed(1)}%
                              </span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </TooltipProvider>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCsvData([]);
                    setDiscountPercent(0);
                  }}
                >
                  Cancelar y Cargar Otro
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cerrar
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={stats.found === 0 || isProcessing}
                  >
                    {isProcessing ? 'Actualizando...' : `Confirmar ${stats.found} Cambios`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

