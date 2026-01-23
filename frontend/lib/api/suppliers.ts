import { SupplierFormData } from '@/types/supplier';

const BASE_URL = '/api/suppliers';

export const suppliersApi = {
  async getAll(params?: { activeOnly?: boolean; searchTerm?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.activeOnly) searchParams.set('activeOnly', 'true');
    if (params?.searchTerm) searchParams.set('searchTerm', params.searchTerm);

    const response = await fetch(`${BASE_URL}?${searchParams.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch suppliers');
    return response.json();
  },

  async getById(id: number) {
    const response = await fetch(`${BASE_URL}/${id}`);
    if (!response.ok) throw new Error('Failed to fetch supplier');
    return response.json();
  },

  async create(supplier: SupplierFormData) {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplier),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create supplier');
    }
    return response.json();
  },

  async update(id: number, supplier: Partial<SupplierFormData>) {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplier),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update supplier');
    }
    return response.json();
  },

  async delete(id: number) {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete supplier');
    return response.json();
  },
};
