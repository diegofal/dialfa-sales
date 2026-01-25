import { useCallback, useState } from 'react';
import { toast } from 'sonner';

export function usePriceImportDraft() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Cargar borrador desde la BD
  const loadDraft = useCallback(async (): Promise<Map<number, number> | null> => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/price-lists/draft');

      if (!response.ok) {
        throw new Error('Failed to load draft');
      }

      const data = await response.json();

      if (data.draft && data.draft.draftData) {
        const map = new Map<number, number>();
        Object.entries(data.draft.draftData).forEach(([key, value]) => {
          map.set(Number(key), value as number);
        });
        return map;
      }

      return null;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Guardar borrador en la BD
  const saveDraft = useCallback(async (proposedPrices: Map<number, number>) => {
    if (proposedPrices.size === 0) return false;

    setIsSaving(true);
    try {
      const draftData = Object.fromEntries(
        Array.from(proposedPrices.entries()).map(([k, v]) => [k.toString(), v])
      );

      const response = await fetch('/api/price-lists/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftData }),
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }

      return true;
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('No se pudo guardar el borrador');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Eliminar borrador de la BD
  const deleteDraft = useCallback(async () => {
    try {
      const response = await fetch('/api/price-lists/draft', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete draft');
      }

      return true;
    } catch (error) {
      console.error('Error deleting draft:', error);
      return false;
    }
  }, []);

  return {
    loadDraft,
    saveDraft,
    deleteDraft,
    isLoading,
    isSaving,
  };
}
