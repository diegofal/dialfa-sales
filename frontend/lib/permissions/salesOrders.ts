import type { SalesOrder } from '@/types/salesOrder';
import type { 
  SalesOrderStatus, 
  SalesOrderPermissions,
  calculateSalesOrderPermissions as calculatePermissions 
} from '@/types/permissions';

/**
 * Extract status information from a SalesOrder entity
 * for permission calculations
 */
export function extractSalesOrderStatus(
  salesOrder: SalesOrder | null | undefined,
  hasUnsavedChanges: boolean = false
): SalesOrderStatus {
  if (!salesOrder) {
    return {
      id: null,
      hasInvoice: false,
      invoicePrinted: false,
      invoiceCancelled: false,
      hasDeliveryNote: false,
      hasUnsavedChanges,
    };
  }

  return {
    id: salesOrder.id,
    hasInvoice: !!salesOrder.invoice,
    invoicePrinted: salesOrder.invoice?.isPrinted ?? false,
    invoiceCancelled: salesOrder.invoice?.isCancelled ?? false,
    hasDeliveryNote: !!salesOrder.deliveryNote,
    hasUnsavedChanges,
  };
}

/**
 * Calculate permissions for a sales order
 * This is the main function to use in components
 */
export function calculateSalesOrderPermissions(
  salesOrder: SalesOrder | null | undefined,
  hasUnsavedChanges: boolean = false
): SalesOrderPermissions {
  const status = extractSalesOrderStatus(salesOrder, hasUnsavedChanges);
  
  // Import the calculation function from types
  const { calculateSalesOrderPermissions: calculate } = require('@/types/permissions');
  
  return calculate(status);
}

/**
 * Validation rules for sales orders
 */
export interface SalesOrderValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSalesOrder(
  clientId: number | null | undefined,
  items: Array<{ quantity: number; stock?: number; articleDescription?: string }>,
  allowLowStock: boolean = true
): SalesOrderValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Rule 1: Client is required
  if (!clientId) {
    errors.push('Debe seleccionar un cliente');
  }

  // Rule 2: At least 1 item is required
  if (!items || items.length === 0) {
    errors.push('Debe agregar al menos un artículo al pedido');
  }

  // Rule 3: All quantities must be > 0
  items.forEach((item, index) => {
    if (item.quantity <= 0) {
      errors.push(`El artículo ${item.articleDescription || `#${index + 1}`} debe tener cantidad mayor a 0`);
    }
  });

  // Rule 4: Stock validation (warning)
  items.forEach((item) => {
    if (item.stock !== undefined && item.quantity > item.stock) {
      const message = `${item.articleDescription || 'Artículo'}: cantidad solicitada (${item.quantity}) excede stock disponible (${item.stock})`;
      
      if (allowLowStock) {
        warnings.push(message);
      } else {
        errors.push(message);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a sales order can be deleted
 */
export function canDeleteSalesOrder(salesOrder: SalesOrder | null | undefined): {
  canDelete: boolean;
  reason?: string;
} {
  if (!salesOrder) {
    return { canDelete: false, reason: 'Pedido no encontrado' };
  }

  // Cannot delete if has an invoice (unless it's cancelled)
  if (salesOrder.invoice && !salesOrder.invoice.isCancelled) {
    return { 
      canDelete: false, 
      reason: 'No se puede eliminar un pedido con factura asociada' 
    };
  }

  return { canDelete: true };
}

/**
 * Check if a sales order can be edited
 */
export function canEditSalesOrder(salesOrder: SalesOrder | null | undefined): {
  canEdit: boolean;
  reason?: string;
} {
  if (!salesOrder) {
    return { canEdit: false, reason: 'Pedido no encontrado' };
  }

  // Cannot edit if invoice is printed
  if (salesOrder.invoice?.isPrinted) {
    return { 
      canEdit: false, 
      reason: 'No se puede modificar un pedido con factura impresa' 
    };
  }

  return { canEdit: true };
}

/**
 * Check if an invoice can be generated from a sales order
 */
export function canGenerateInvoice(salesOrder: SalesOrder | null | undefined): {
  canGenerate: boolean;
  reason?: string;
} {
  if (!salesOrder || !salesOrder.id) {
    return { canGenerate: false, reason: 'El pedido debe estar guardado' };
  }

  // Cannot generate if already has an active invoice (not cancelled)
  if (salesOrder.invoice && !salesOrder.invoice.isCancelled) {
    return { 
      canGenerate: false, 
      reason: 'El pedido ya tiene una factura asociada' 
    };
  }

  return { canGenerate: true };
}

