'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ChangePriceDialogProps {
  articleId: number;
  articleCode: string;
  articleDescription: string;
  currentPrice: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePriceDialog({
  articleId,
  articleCode,
  articleDescription,
  currentPrice,
  isOpen,
  onClose,
}: ChangePriceDialogProps) {
  const [newPrice, setNewPrice] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const queryClient = useQueryClient();

  const changePriceMutation = useMutation({
    mutationFn: async (data: { newPrice: number; notes: string }) => {
      const response = await fetch(`/api/articles/${articleId}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'No se pudo modificar el precio');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Precio modificado correctamente');
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['article', articleId] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    setNewPrice('');
    setNotes('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Ingrese un precio válido');
      return;
    }

    changePriceMutation.mutate({ newPrice: price, notes });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Modificar Precio</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{articleCode}</span>
              <span className="text-muted-foreground text-xs">{articleDescription}</span>
              <span className="mt-1 text-xs font-medium">
                Precio actual: ${currentPrice.toFixed(2)}
              </span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="newPrice">Nuevo precio</Label>
              <Input
                id="newPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder={currentPrice.toFixed(2)}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Motivo del cambio..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={changePriceMutation.isPending}>
              {changePriceMutation.isPending ? 'Guardando...' : 'Modificar Precio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
