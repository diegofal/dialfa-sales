import { ImportResult } from '@/lib/services/proformaImport/types';

const BASE_URL = '/api/supplier-orders/import';

export const proformaImportApi = {
  async import(file: File): Promise<{ success: boolean; data: ImportResult }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(BASE_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to import proforma');
    }

    return response.json();
  },
};




