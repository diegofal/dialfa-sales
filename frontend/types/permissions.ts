// Sales Order Permission Types
export interface SalesOrderStatus {
  id: number | null;
  hasInvoice: boolean;
  invoicePrinted: boolean;
  invoiceCancelled: boolean;
  hasDeliveryNote: boolean;
  hasUnsavedChanges: boolean;
}

export interface SalesOrderPermissions {
  canEdit: boolean;
  canSave: boolean;
  canCreateInvoice: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canCreateDeliveryNote: boolean;
}

/**
 * Calculate permissions for a sales order based on its current state
 * Based on BUTTON_STATUSES.md business rules
 */
export function calculateSalesOrderPermissions(
  status: SalesOrderStatus
): SalesOrderPermissions {
  return {
    // No se puede editar si la factura fue impresa
    canEdit: !status.invoicePrinted,
    
    // Solo se puede guardar si es editable
    canSave: !status.invoicePrinted,
    
    // Solo crear factura si está guardado y no tiene factura activa
    canCreateInvoice: 
      status.id !== null && 
      (!status.hasInvoice || status.invoiceCancelled),
    
    // No cancelar si tiene factura impresa
    canCancel: !status.invoicePrinted,
    
    // No eliminar si tiene factura (impresa o no)
    canDelete: !status.hasInvoice,
    
    // Crear remito si está guardado
    canCreateDeliveryNote: status.id !== null
  };
}

// Invoice Permission Types
export interface InvoiceStatus {
  id: number | null;
  isPrinted: boolean;
  isCancelled: boolean;
}

export interface InvoicePermissions {
  canEdit: boolean;
  canSave: boolean;
  canPrint: boolean;
  canCancel: boolean;
}

/**
 * Calculate permissions for an invoice based on its current state
 * Based on BUTTON_STATUSES.md business rules
 */
export function calculateInvoicePermissions(
  status: InvoiceStatus
): InvoicePermissions {
  return {
    // No permitir editar si ya fue impresa o cancelada
    canEdit: !status.isPrinted && !status.isCancelled,
    
    // No permitir guardar si ya fue impresa o cancelada
    canSave: !status.isPrinted && !status.isCancelled,
    
    // Permitir imprimir si está guardada y no cancelada
    canPrint: status.id !== null && !status.isCancelled,
    
    // Permitir cancelar si está guardada y no está ya cancelada
    canCancel: status.id !== null && !status.isCancelled,
  };
}

