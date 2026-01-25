'use client';

import { Info, TrendingUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PriceListItem, PaymentDiscount } from '@/types/priceList';

interface PriceListTableProps {
  items: PriceListItem[];
  paymentDiscounts: PaymentDiscount[];
  onPriceChange: (articleId: number, newPrice: number) => void;
  editingPrices: Map<number, number>;
  proposedPrices: Map<number, number>;
}

export function PriceListTable({
  items,
  paymentDiscounts,
  onPriceChange,
  editingPrices,
  proposedPrices,
}: PriceListTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

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
      <div className="text-muted-foreground py-8 text-center">
        No hay artículos en esta categoría
      </div>
    );
  }

  return (
    <div className="bg-background w-full rounded-lg border">
      <div className="relative max-h-[600px] w-full overflow-x-auto overflow-y-auto">
        <div className="inline-block min-w-max align-top">
          <TooltipProvider>
            <Table className="w-full caption-bottom text-sm">
              <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                  <TableHead className="min-w-[100px]">Código</TableHead>
                  <TableHead className="min-w-[250px]">Descripción</TableHead>
                  <TableHead className="min-w-[110px] text-right">Precio Base</TableHead>
                  <TableHead className="min-w-[130px] text-right">Precio Propuesto</TableHead>
                  <TableHead className="min-w-[80px] text-right">Stock</TableHead>
                  <TableHead className="min-w-[90px] text-right">P. Compra</TableHead>
                  <TableHead className="min-w-[70px] text-right">CIF %</TableHead>
                  <TableHead className="min-w-[90px] text-right">Valor CIF</TableHead>

                  {/* Columnas dinámicas por payment term */}
                  {paymentDiscounts.map((pd) => (
                    <TableHead
                      key={pd.paymentTermId}
                      className="border-border border-l-2 text-center"
                      colSpan={3}
                    >
                      <div className="px-2 text-sm font-bold whitespace-nowrap">
                        {pd.paymentTermCode}
                      </div>
                      <div className="text-muted-foreground mt-1 grid grid-cols-3 gap-2 px-2 text-[10px] font-normal">
                        <div className="min-w-[70px]">Precio</div>
                        <div className="min-w-[60px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex cursor-help items-center justify-center gap-0.5">
                                Marg%
                                <Info className="h-2.5 w-2.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="w-[200px]">
                              <div className="space-y-1">
                                <p className="text-xs font-semibold">Margen sobre Ventas</p>
                                <p className="text-[10px]">= (Precio - CIF) / Precio × 100</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="min-w-[60px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex cursor-help items-center justify-center gap-0.5">
                                Mkup%
                                <Info className="h-2.5 w-2.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="w-[200px]">
                              <div className="space-y-1">
                                <p className="text-xs font-semibold">Rentabilidad (ROI)</p>
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
                  const basePrice = proposedPrices.has(item.id)
                    ? proposedPrices.get(item.id)!
                    : displayPrice;

                  // Calcular CIF
                  const hasCostAndCif =
                    item.costPrice &&
                    item.costPrice > 0 &&
                    item.cifPercentage &&
                    item.cifPercentage > 0;
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
                            <Badge variant="secondary" className="py-0 text-[10px]">
                              Modificado
                            </Badge>
                          )}
                          {item.isDiscontinued && (
                            <Badge variant="destructive" className="py-0 text-[10px]">
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
                            className="h-7 text-right text-xs"
                            autoFocus
                          />
                        ) : (
                          <span className={hasChanges ? 'text-primary font-semibold' : ''}>
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
                              <span
                                className={`text-[10px] font-semibold ${
                                  proposedPrices.get(item.id)! > item.unitPrice
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {proposedPrices.get(item.id)! > item.unitPrice ? '+' : ''}
                                {(
                                  ((proposedPrices.get(item.id)! - item.unitPrice) /
                                    item.unitPrice) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">{item.stock.toFixed(2)}</TableCell>
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
                      {paymentDiscounts.map((pd) => {
                        const finalPrice = calculatePriceWithDiscount(
                          basePrice,
                          pd.discountPercent
                        );
                        const { margin, markup } = calculateMarginAndMarkup(finalPrice, cifValue);

                        return (
                          <TableCell
                            key={pd.paymentTermId}
                            colSpan={3}
                            className="border-border border-l-2 px-2"
                          >
                            <div className="grid min-w-[200px] grid-cols-3 gap-2 text-xs">
                              <div className="text-primary min-w-[70px] text-right font-semibold whitespace-nowrap">
                                ${finalPrice.toFixed(2)}
                                <div className="text-muted-foreground text-[9px] font-normal">
                                  -{pd.discountPercent.toFixed(1)}%
                                </div>
                              </div>
                              <div className="min-w-[60px] text-right">
                                {margin !== undefined ? (
                                  <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                                    {margin >= 30 ? (
                                      <TrendingUp className="h-3 w-3 flex-shrink-0 text-green-600" />
                                    ) : margin >= 15 ? (
                                      <TrendingUp className="h-3 w-3 flex-shrink-0 text-yellow-600" />
                                    ) : (
                                      <TrendingDown className="h-3 w-3 flex-shrink-0 text-red-600" />
                                    )}
                                    <span
                                      className={
                                        margin >= 30
                                          ? 'font-semibold text-green-600'
                                          : margin >= 15
                                            ? 'text-yellow-600'
                                            : 'text-red-600'
                                      }
                                    >
                                      {margin.toFixed(1)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                              <div className="min-w-[60px] text-right">
                                {markup !== undefined ? (
                                  <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                                    {markup >= 100 ? (
                                      <TrendingUp className="h-3 w-3 flex-shrink-0 text-green-600" />
                                    ) : markup >= 50 ? (
                                      <TrendingUp className="h-3 w-3 flex-shrink-0 text-yellow-600" />
                                    ) : (
                                      <TrendingDown className="h-3 w-3 flex-shrink-0 text-red-600" />
                                    )}
                                    <span
                                      className={
                                        markup >= 100
                                          ? 'font-semibold text-green-600'
                                          : markup >= 50
                                            ? 'text-yellow-600'
                                            : 'text-red-600'
                                      }
                                    >
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
