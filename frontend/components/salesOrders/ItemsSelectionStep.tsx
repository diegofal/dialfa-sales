'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useArticles } from '@/lib/hooks/useArticles';
import type { SalesOrderFormData, SalesOrderItemFormData } from '@/types/salesOrder';

interface ItemsSelectionStepProps {
  formData: SalesOrderFormData;
  setFormData: (data: SalesOrderFormData) => void;
}

export function ItemsSelectionStep({ formData, setFormData }: ItemsSelectionStepProps) {
  const { data: articles = [], isLoading } = useArticles({ activeOnly: true });
  const [newItem, setNewItem] = useState<Partial<SalesOrderItemFormData>>({
    quantity: 1,
    discountPercent: 0,
  });

  const selectedArticle = articles.find((a) => a.id === newItem.articleId);

  const handleAddItem = () => {
    if (!newItem.articleId || !newItem.quantity || newItem.unitPrice === undefined) {
      return;
    }

    const article = articles.find((a) => a.id === newItem.articleId);
    if (!article) return;

    const item: SalesOrderItemFormData = {
      articleId: newItem.articleId,
      articleCode: article.code,
      articleDescription: article.description,
      quantity: newItem.quantity,
      unitPrice: newItem.unitPrice,
      discountPercent: newItem.discountPercent || 0,
    };

    setFormData({
      ...formData,
      items: [...formData.items, item],
    });

    // Reset form
    setNewItem({
      quantity: 1,
      discountPercent: 0,
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const calculateLineTotal = (item: SalesOrderItemFormData) => {
    const subtotal = item.quantity * item.unitPrice;
    const discount = subtotal * (item.discountPercent / 100);
    return subtotal - discount;
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Add Item Form */}
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-medium">Agregar Artículo</h3>
        <div className="grid gap-4 md:grid-cols-5">
          <div className="md:col-span-2 space-y-2">
            <Label>Artículo</Label>
            <Select
              value={newItem.articleId?.toString()}
              onValueChange={(value) => {
                const articleId = parseInt(value);
                const article = articles.find((a) => a.id === articleId);
                setNewItem({
                  ...newItem,
                  articleId,
                  unitPrice: article?.unitPrice || 0,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? 'Cargando...' : 'Selecciona un artículo'} />
              </SelectTrigger>
              <SelectContent>
                {articles.map((article) => (
                  <SelectItem key={article.id} value={article.id.toString()}>
                    {article.code} - {article.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedArticle && (
              <p className="text-xs text-muted-foreground">
                Stock: {selectedArticle.stock} | Precio: {formatCurrency(selectedArticle.unitPrice)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Cantidad</Label>
            <Input
              type="number"
              min="1"
              value={newItem.quantity || ''}
              onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label>Precio Unit.</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={newItem.unitPrice || ''}
              onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="space-y-2">
            <Label>Desc. %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={newItem.discountPercent || ''}
              onChange={(e) =>
                setNewItem({ ...newItem, discountPercent: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
        </div>

        <Button
          onClick={handleAddItem}
          disabled={!newItem.articleId || !newItem.quantity || newItem.unitPrice === undefined}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Item
        </Button>
      </div>

      {/* Items Table */}
      {formData.items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Precio Unit.</TableHead>
                <TableHead className="text-right">Desc. %</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formData.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.articleCode}</TableCell>
                  <TableCell>{item.articleDescription}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">{item.discountPercent}%</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(calculateLineTotal(item))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5} className="text-right font-bold">
                  Total:
                </TableCell>
                <TableCell className="text-right font-bold text-lg">
                  {formatCurrency(calculateTotal())}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No hay artículos agregados. Agrega al menos un artículo para continuar.
        </div>
      )}
    </div>
  );
}

