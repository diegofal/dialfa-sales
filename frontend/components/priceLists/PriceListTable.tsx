'use client';

import { useState } from 'react';
import { PriceListItem } from '@/types/priceList';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, Save, X } from 'lucide-react';

interface PriceListTableProps {
  items: PriceListItem[];
  onPriceChange: (articleId: number, newPrice: number) => void;
  editingPrices: Map<number, number>;
  proposedPrices: Map<number, number>;
}

export function PriceListTable({ items, onPriceChange, editingPrices, proposedPrices }: PriceListTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

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

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay artículos en esta categoría
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="w-[150px] text-right">Precio Unitario</TableHead>
            <TableHead className="w-[150px] text-right">Nuevo Precio Propuesto</TableHead>
            <TableHead className="w-[100px]">Estado</TableHead>
            <TableHead className="w-[80px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const isEditing = editingId === item.id;
            const hasChanges = editingPrices.has(item.id);
            const displayPrice = hasChanges ? editingPrices.get(item.id)! : item.unitPrice;

            return (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.code}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {item.description}
                    {hasChanges && (
                      <Badge variant="secondary" className="text-xs">
                        Modificado
                      </Badge>
                    )}
                    {item.isDiscontinued && (
                      <Badge variant="destructive" className="text-xs">
                        Discontinuado
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tempPrice}
                      onChange={(e) => setTempPrice(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, item.id)}
                      className="text-right"
                      autoFocus
                    />
                  ) : (
                    <span className={hasChanges ? 'font-semibold text-primary' : ''}>
                      ${displayPrice.toFixed(2)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {proposedPrices.has(item.id) ? (
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-blue-600">
                        ${proposedPrices.get(item.id)!.toFixed(2)}
                      </span>
                      {item.unitPrice !== proposedPrices.get(item.id)! && (
                        <span className={`text-xs ${
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
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={item.isActive ? 'default' : 'secondary'}>
                    {item.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleSaveEdit(item.id)}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleStartEdit(item)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

