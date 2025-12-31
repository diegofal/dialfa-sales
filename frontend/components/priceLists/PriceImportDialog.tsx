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
import { PaymentDiscount } from '@/types/priceList';

interface PaymentTermPrice {
  paymentTermId: number;
  paymentTermCode: string;
  paymentTermName: string;
  discountPercent: number;
  finalPrice: number;
  margin?: number;
  markup?: number;
}

interface ImportPreviewItem {
  code: string;
  articleId?: number;
  description?: string;
  currentPrice?: number;
  costPrice?: number;
  cifPercentage?: number;
  cifValue?: number;
  newPrice: number;
  paymentTermPrices: PaymentTermPrice[];
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
    categoryId: number;
    paymentDiscounts: PaymentDiscount[];
  }>;
  paymentTerms: PaymentDiscount[];
}

export function PriceImportDialog({ open, onOpenChange, onConfirm, articles, paymentTerms }: PriceImportDialogProps) {
  const [csvData, setCsvData] = useState<ImportPreviewItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const calculatePaymentTermPrices = (
    newPrice: number,
    paymentDiscounts: PaymentDiscount[],
    cifValue?: number
  ): PaymentTermPrice[] => {
    return paymentDiscounts.map(pd => {
      const finalPrice = newPrice * (1 - pd.discountPercent / 100);
      
      // Calcular margen y markup si hay CIF
      let margin: number | undefined;
      let markup: number | undefined;
      
      if (cifValue && cifValue > 0) {
        const marginAmount = finalPrice - cifValue;
        margin = (marginAmount / finalPrice) * 100;
        markup = (marginAmount / cifValue) * 100;
      }
      
      return {
        paymentTermId: pd.paymentTermId,
        paymentTermCode: pd.paymentTermCode,
        paymentTermName: pd.paymentTermName,
        discountPercent: pd.discountPercent,
        finalPrice,
        margin,
        markup,
      };
    });
  };

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
              newPrice,
              paymentTermPrices: [],
              status: 'not-found' as const,
            };
          }

          // Calcular CIF: Último Precio Compra * (1 + CIF%)
          const hasCostAndCif = article.costPrice && article.costPrice > 0 && article.cifPercentage && article.cifPercentage > 0;
          const cifValue = hasCostAndCif 
            ? article.costPrice! * (1 + article.cifPercentage! / 100)
            : undefined;
          
          // Calcular precios por condición de pago
          const paymentTermPrices = calculatePaymentTermPrices(
            newPrice,
            article.paymentDiscounts,
            cifValue
          );

          return {
            code,
            articleId: article.id,
            description: article.description,
            currentPrice: article.unitPrice,
            costPrice: article.costPrice,
            cifPercentage: article.cifPercentage,
            cifValue,
            newPrice,
            paymentTermPrices,
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

  const handleConfirm = async () => {
    const validUpdates = csvData
      .filter(item => item.status === 'found' || item.status === 'no-cost')
      .filter(item => item.articleId)
      .map(item => ({
        articleId: item.articleId!,
        newPrice: item.newPrice,
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
      .flatMap(i => i.paymentTermPrices.map(p => p.markup).filter(m => m !== undefined) as number[])
      .reduce((sum, m, _, arr) => sum + m / arr.length, 0) || 0,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[98vw] !w-[1800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Precios desde CSV</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con las columnas: Codigo, NuevoDB (precio sin descuento)
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

              {/* Preview Table */}
              <div className="border rounded-lg overflow-auto max-h-96">
                <TooltipProvider>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Código</TableHead>
                        <TableHead className="w-[200px]">Descripción</TableHead>
                        <TableHead className="text-right w-[100px]">Precio Actual</TableHead>
                        <TableHead className="text-right w-[100px]">Precio CSV</TableHead>
                        <TableHead className="text-right w-[80px]">% Cambio</TableHead>
                        <TableHead className="text-right w-[90px]">Últ. P. Compra</TableHead>
                        <TableHead className="text-right w-[70px]">CIF %</TableHead>
                        <TableHead className="text-right w-[90px]">Valor CIF</TableHead>
                        
                        {/* Columnas dinámicas por payment term */}
                        {paymentTerms.map(pt => (
                          <TableHead key={pt.paymentTermId} className="text-right w-[150px]" colSpan={3}>
                            <div className="text-center font-bold border-l border-border pl-2">
                              {pt.paymentTermCode}
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground mt-1">
                              <div>Precio</div>
                              <div>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help flex items-center justify-center gap-0.5">
                                      Marg%
                                      <Info className="h-3 w-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="w-[280px]">
                                    <div className="space-y-2">
                                      <p className="font-semibold">Margen sobre Ventas</p>
                                      <p className="text-xs">Fórmula: (Precio - CIF) / Precio × 100</p>
                                      <p className="text-xs">Indica qué % del precio de venta es ganancia.</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <div>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help flex items-center justify-center gap-0.5">
                                      Mkup%
                                      <Info className="h-3 w-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="w-[280px]">
                                    <div className="space-y-2">
                                      <p className="font-semibold">Rentabilidad sobre Costo (ROI)</p>
                                      <p className="text-xs">Fórmula: (Precio - CIF) / CIF × 100</p>
                                      <p className="text-xs">Cuánto ganas por cada dólar invertido.</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.map((item, idx) => {
                        const priceChange = item.currentPrice 
                          ? ((item.newPrice - item.currentPrice) / item.currentPrice) * 100
                          : null;
                        
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{item.code}</TableCell>
                            <TableCell className="text-xs">
                              {item.description || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {item.currentPrice ? `$${item.currentPrice.toFixed(2)}` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">
                              ${item.newPrice.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {priceChange !== null ? (
                                <span className={priceChange < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                                  {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
                                </span>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {item.costPrice ? `$${item.costPrice.toFixed(2)}` : '-'}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                              {item.cifPercentage ? `${item.cifPercentage.toFixed(1)}%` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium text-sm">
                              {item.cifValue ? `$${item.cifValue.toFixed(2)}` : '-'}
                            </TableCell>
                            
                            {/* Columnas dinámicas por payment term */}
                            {paymentTerms.map(pt => {
                              const ptPrice = item.paymentTermPrices.find(p => p.paymentTermId === pt.paymentTermId);
                              
                              return (
                                <TableCell key={pt.paymentTermId} colSpan={3} className="border-l border-border">
                                  {ptPrice ? (
                                    <div className="grid grid-cols-3 gap-1 text-xs">
                                      <div className="text-right font-semibold text-primary">
                                        ${ptPrice.finalPrice.toFixed(2)}
                                        <div className="text-[10px] text-muted-foreground">
                                          -{ptPrice.discountPercent.toFixed(1)}%
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        {ptPrice.margin !== undefined ? (
                                          <span className={
                                            ptPrice.margin >= 30 ? 'text-green-600 font-semibold' :
                                            ptPrice.margin >= 15 ? 'text-yellow-600' : 'text-red-600'
                                          }>
                                            {ptPrice.margin.toFixed(1)}%
                                          </span>
                                        ) : '-'}
                                      </div>
                                      <div className="text-right">
                                        {ptPrice.markup !== undefined ? (
                                          <span className={
                                            ptPrice.markup >= 100 ? 'text-green-600 font-semibold' :
                                            ptPrice.markup >= 50 ? 'text-yellow-600' : 'text-red-600'
                                          }>
                                            {ptPrice.markup.toFixed(1)}%
                                          </span>
                                        ) : '-'}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-center text-muted-foreground text-xs">-</div>
                                  )}
                                </TableCell>
                              );
                            })}
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
