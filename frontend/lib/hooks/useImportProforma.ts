import { useMutation } from '@tanstack/react-query';
import { proformaImportApi } from '../api/proformaImport';
import { toast } from 'sonner';

export function useImportProforma() {
  return useMutation({
    mutationFn: (file: File) => proformaImportApi.import(file),
    onError: (error: Error) => {
      toast.error(error.message || 'Error al importar la proforma');
    },
  });
}



