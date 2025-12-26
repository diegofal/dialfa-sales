import { SupplierOrderFormData, SupplierOrderStatus } from '@/types/supplierOrder';

const BASE_URL = '/api/supplier-orders';

export const supplierOrdersApi = {
  async getAll(params?: { status?: SupplierOrderStatus; supplierId?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.supplierId) searchParams.set('supplierId', params.supplierId.toString());

    const response = await fetch(`${BASE_URL}?${searchParams.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch supplier orders');
    return response.json();
  },

  async getById(id: number) {
    const response = await fetch(`${BASE_URL}/${id}`);
    if (!response.ok) throw new Error('Failed to fetch supplier order');
    return response.json();
  },

  async create(order: SupplierOrderFormData) {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create supplier order');
    }
    return response.json();
  },

  async update(id: number, order: Partial<SupplierOrderFormData>) {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update supplier order');
    }
    return response.json();
  },

  async updateStatus(id: number, status: SupplierOrderStatus) {
    const response = await fetch(`${BASE_URL}/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update order status');
    }
    return response.json();
  },

  async delete(id: number) {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete supplier order');
    return response.json();
  },
};


