import { useMemo } from 'react';
import type { SalesOrder } from '@/types/salesOrder';
import type { SalesOrderPermissions } from '@/types/permissions';
import { calculateSalesOrderPermissions } from '@/lib/permissions/salesOrders';

/**
 * React hook to calculate permissions for a sales order
 * 
 * @param salesOrder - The sales order entity
 * @param hasUnsavedChanges - Whether there are unsaved changes
 * @returns Computed permissions object
 * 
 * @example
 * ```tsx
 * const permissions = useSalesOrderPermissions(salesOrder, hasChanges);
 * 
 * <Button 
 *   onClick={handleSave}
 *   disabled={!permissions.canSave}
 * >
 *   Guardar
 * </Button>
 * ```
 */
export function useSalesOrderPermissions(
  salesOrder: SalesOrder | null | undefined,
  hasUnsavedChanges: boolean = false
): SalesOrderPermissions {
  const permissions = useMemo(() => {
    return calculateSalesOrderPermissions(salesOrder, hasUnsavedChanges);
  }, [
    salesOrder?.id,
    salesOrder?.invoice?.id,
    salesOrder?.invoice?.isPrinted,
    salesOrder?.invoice?.isCancelled,
    salesOrder?.deliveryNote?.id,
    hasUnsavedChanges,
  ]);

  return permissions;
}

