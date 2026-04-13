import type { Supplier, SupplierFormData } from '@/types/supplier';
import { suppliersApi } from '../../api/suppliers';
import { createCRUDHooks } from '../api/createCRUDHooks';

type SupplierListParams = { activeOnly?: boolean; searchTerm?: string };

const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  Supplier,
  SupplierFormData,
  Partial<SupplierFormData>,
  SupplierListParams
>({
  entityName: 'Proveedor',
  api: suppliersApi,
  queryKey: 'suppliers',
});

export {
  useList as useSuppliers,
  useById as useSupplier,
  useCreate as useCreateSupplier,
  useUpdate as useUpdateSupplier,
  useDelete as useDeleteSupplier,
};
