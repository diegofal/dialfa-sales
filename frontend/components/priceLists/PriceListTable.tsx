'use client';

import { useState } from 'react';
import { PriceListItem, PaymentDiscount } from '@/types/priceList';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, TrendingUp, TrendingDown } from 'lucide-react';

interface PriceListTableProps {
  items: PriceListItem[];
  paymentDiscounts: PaymentDiscount[];
  onPriceChange: (articleId: number, newPrice: number) => void;
  editingPrices: Map<number, number>;
  proposedPrices: Map<number, number>;
}

export function PriceListTable({ items, paymentDiscounts, onPriceChange, editingPrices, proposedPrices }: PriceListTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  
  // Debug: Ver qué payment discounts están llegando
  console.log('PriceListTable - paymentDiscounts:', paymentDiscounts);

  const handleStartEdit = (item: PriceListItem) => {
    setEditingId(item.id);
    const currentPrice = editingPrices.has(item.id) 
      ? editingPrices.get(item.id)! 
      : item.unitPrice;
    setTempPrice(currentPrice.toString());
  };

  const handleSaveEdit = (articleId: number) => {
    const newPrice = parseFloat(tempPrice);
    if (!isNaN(newPrice) && newPrice >= 0) {
      onPriceChange(articleId, newPrice);
    }
    setEditingId(null);
    setTempPrice('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTempPrice('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, articleId: number) => {
    if (e.key === 'Enter') {
      handleSaveEdit(articleId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const calculatePriceWithDiscount = (basePrice: number, discountPercent: number) => {
    return basePrice * (1 - discountPercent / 100);
  };

  const calculateMarginAndMarkup = (price: number, cifValue?: number) => {
    if (!cifValue || cifValue <= 0) return { margin: undefined, markup: undefined };
    
    const marginAmount = price - cifValue;
    const margin = (marginAmount / price) * 100;
    const markup = (marginAmount / cifValue) * 100;
    
    return { margin, markup };
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay artículos en esta categoría
      </div>
    );
  }

  return (
    <div className="w-full border rounded-lg bg-background">
      <div className="max-h-[600px] w-full overflow-x-auto overflow-y-auto relative">
        <div className="inline-block min-w-max align-top">
          <TooltipProvider>
            <Table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <TableHead className="min-w-[100px]">Código</TableHead>
                <TableHead className="min-w-[250px]">Descripción</TableHead>
                <TableHead className="min-w-[110px] text-right">Precio Base</TableHead>
                <TableHead className="min-w-[130px] text-right">Precio Propuesto</TableHead>
                <TableHead className="min-w-[80px] text-right">Stock</TableHead>
                <TableHead className="min-w-[90px] text-right">P. Compra</TableHead>
                <TableHead className="min-w-[70px] text-right">CIF %</TableHead>
                <TableHead className="min-w-[90px] text-right">Valor CIF</TableHead>
                
                {/* Columnas dinámicas por payment term */}
                {paymentDiscounts.map(pd => (
                  <TableHead key={pd.paymentTermId} className="text-center border-l-2 border-border" colSpan={3}>
                    <div className="font-bold text-sm whitespace-nowrap px-2">{pd.paymentTermCode}</div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground mt-1 font-normal px-2">
                      <div className="min-w-[70px]">Precio</div>
                      <div className="min-w-[60px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help flex items-center justify-center gap-0.5">
                              Marg%
                              <Info className="h-2.5 w-2.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="w-[200px]">
                            <div className="space-y-1">
                              <p className="font-semibold text-xs">Margen sobre Ventas</p>
                              <p className="text-[10px]">= (Precio - CIF) / Precio × 100</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="min-w-[60px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help flex items-center justify-center gap-0.5">
                              Mkup%
                              <Info className="h-2.5 w-2.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="w-[200px]">
                            <div className="space-y-1">
                              <p className="font-semibold text-xs">Rentabilidad (ROI)</p>
                              <p className="text-[10px]">= (Precio - CIF) / CIF × 100</p>
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
              {items.map((item) => {
                const isEditing = editingId === item.id;
                const hasChanges = editingPrices.has(item.id);
                const displayPrice = hasChanges ? editingPrices.get(item.id)! : item.unitPrice;
                const basePrice = proposedPrices.has(item.id) ? proposedPrices.get(item.id)! : displayPrice;
                
                // Calcular CIF
                const hasCostAndCif = item.costPrice && item.costPrice > 0 && item.cifPercentage && item.cifPercentage > 0;
                const cifValue = hasCostAndCif 
                  ? item.costPrice! * (1 + item.cifPercentage! / 100)
                  : undefined;

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        {item.description}
                        {hasChanges && (
                          <Badge variant="secondary" className="text-[10px] py-0">
                            Modificado
                          </Badge>
                        )}
                        {item.isDiscontinued && (
                          <Badge variant="destructive" className="text-[10px] py-0">
                            Discontinuado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tempPrice}
                          onChange={(e) => setTempPrice(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                          className="text-right h-7 text-xs"
                          autoFocus
                        />
                      ) : (
                        <span className={hasChanges ? 'font-semibold text-primary' : ''}>
                          ${displayPrice.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {proposedPrices.has(item.id) ? (
                        <div className="flex flex-col items-end">
                          <span className="font-semibold text-blue-600">
                            ${proposedPrices.get(item.id)!.toFixed(2)}
                          </span>
                          {item.unitPrice !== proposedPrices.get(item.id)! && (
                            <span className={`text-[10px] font-semibold ${
                              proposedPrices.get(item.id)! > item.unitPrice 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              {proposedPrices.get(item.id)! > item.unitPrice ? '+' : ''}
                              {((proposedPrices.get(item.id)! - item.unitPrice) / item.unitPrice * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {item.stock.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {item.costPrice ? `$${item.costPrice.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {item.cifPercentage ? `${item.cifPercentage.toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {cifValue ? `$${cifValue.toFixed(2)}` : '-'}
                    </TableCell>
                    
                    {/* Columnas dinámicas por payment term */}
                    {paymentDiscounts.map(pd => {
                      const finalPrice = calculatePriceWithDiscount(basePrice, pd.discountPercent);
                      const { margin, markup } = calculateMarginAndMarkup(finalPrice, cifValue);
                      
                      return (
                        <TableCell key={pd.paymentTermId} colSpan={3} className="border-l-2 border-border px-2">
                          <div className="grid grid-cols-3 gap-2 text-xs min-w-[200px]">
                            <div className="text-right font-semibold text-primary whitespace-nowrap min-w-[70px]">
                              ${finalPrice.toFixed(2)}
                              <div className="text-[9px] text-muted-foreground font-normal">
                                -{pd.discountPercent.toFixed(1)}%
                              </div>
                            </div>
                            <div className="text-right min-w-[60px]">
                              {margin !== undefined ? (
                                <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                                  {margin >= 30 ? (
                                    <TrendingUp className="h-3 w-3 text-green-600 flex-shrink-0" />
                                  ) : margin >= 15 ? (
                                    <TrendingUp className="h-3 w-3 text-yellow-600 flex-shrink-0" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 text-red-600 flex-shrink-0" />
                                  )}
                                  <span className={
                                    margin >= 30 ? 'text-green-600 font-semibold' :
                                    margin >= 15 ? 'text-yellow-600' : 'text-red-600'
                                  }>
                                    {margin.toFixed(1)}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                            <div className="text-right min-w-[60px]">
                              {markup !== undefined ? (
                                <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                                  {markup >= 100 ? (
                                    <TrendingUp className="h-3 w-3 text-green-600 flex-shrink-0" />
                                  ) : markup >= 50 ? (
                                    <TrendingUp className="h-3 w-3 text-yellow-600 flex-shrink-0" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 text-red-600 flex-shrink-0" />
                                  )}
                                  <span className={
                                    markup >= 100 ? 'text-green-600 font-semibold' :
                                    markup >= 50 ? 'text-yellow-600' : 'text-red-600'
                                  }>
                                    {markup.toFixed(1)}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </div>
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
      </div>
    </div>
  );
}
