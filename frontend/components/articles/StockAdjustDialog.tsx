'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { STOCK_ADJUSTMENT_REASONS } from '@/lib/constants/stockMovementTypes';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface StockAdjustDialogProps {
  articleId: number;
  articleCode: string;
  articleDescription: string;
  currentStock: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function StockAdjustDialog({
  articleId,
  articleCode,
  articleDescription,
  currentStock,
  isOpen,
  onClose,
}: StockAdjustDialogProps) {
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('INVENTORY');
  const [notes, setNotes] = useState<string>('');
  const queryClient = useQueryClient();

  const adjustStockMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/stock-movements/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to adjust stock');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Stock ajustado correctamente');
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    setQuantity('');
    setReason('INVENTORY');
    setNotes('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty === 0) {
      toast.error('Ingrese una cantidad válida distinta de cero');
      return;
    }

    adjustStockMutation.mutate({
      articleId,
      quantity: qty,
      reason: STOCK_ADJUSTMENT_REASONS[reason as keyof typeof STOCK_ADJUSTMENT_REASONS],
      notes,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajustar Stock</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{articleCode}</span>
              <span className="text-xs text-muted-foreground">{articleDescription}</span>
              <span className="text-xs font-medium mt-1">Stock actual: {currentStock}</span>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="quantity">Cantidad a ajustar (+/-)</Label>
              <Input
                id="quantity"
                type="number"
                step="any"
                placeholder="Ej: 10 o -5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">
                Use valores positivos para agregar stock y negativos para quitar.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STOCK_ADJUSTMENT_REASONS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Detalles adicionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={adjustStockMutation.isPending}>
              {adjustStockMutation.isPending ? 'Guardando...' : 'Ajustar Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

