import { useMemo } from 'react';
import type { SalesOrder } from '@/types/salesOrder';
import type { SalesOrderPermissions } from '@/types/permissions';
import { calculateSalesOrderPermissions } from '@/lib/permissions/salesOrders';

/**
 * React hook to calculate permissions for a sales order
 * 
 * @param salesOrder - The sales order entity
 * @returns Computed permissions object
 * 
 * @example
 * ```tsx
 * const permissions = useSalesOrderPermissions(salesOrder);
 * 
 * <Button 
 *   onClick={handleDelete}
 *   disabled={!permissions.canDelete}
 * >
 *   Eliminar
 * </Button>
 * ```
 */
export function useSalesOrderPermissions(
  salesOrder: SalesOrder | null | undefined
): SalesOrderPermissions {
  const permissions = useMemo(() => {
    return calculateSalesOrderPermissions(salesOrder, false);
  }, [
    salesOrder?.id,
    salesOrder?.invoice?.id,
    salesOrder?.invoice?.isPrinted,
    salesOrder?.invoice?.isCancelled,
    salesOrder?.deliveryNote?.id,
  ]);

  return permissions;
}


