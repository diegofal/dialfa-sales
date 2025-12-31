export const OPERATIONS = {
  // Pedidos
  ORDER_CREATE: 'ORDER_CREATE',
  ORDER_UPDATE: 'ORDER_UPDATE',
  ORDER_DELETE: 'ORDER_DELETE',
  
  // Facturas
  INVOICE_CREATE: 'INVOICE_CREATE',
  INVOICE_UPDATE: 'INVOICE_UPDATE',
  INVOICE_DELETE: 'INVOICE_DELETE',
  INVOICE_PRINT: 'INVOICE_PRINT',
  INVOICE_CANCEL: 'INVOICE_CANCEL',
  
  // Remitos
  DELIVERY_CREATE: 'DELIVERY_CREATE',
  DELIVERY_UPDATE: 'DELIVERY_UPDATE',
  DELIVERY_DELETE: 'DELIVERY_DELETE',
  DELIVERY_PRINT: 'DELIVERY_PRINT',
  
  // Stock
  STOCK_ADJUST: 'STOCK_ADJUST',
  
  // Clientes
  CLIENT_CREATE: 'CLIENT_CREATE',
  CLIENT_UPDATE: 'CLIENT_UPDATE',
  CLIENT_DELETE: 'CLIENT_DELETE',
  
  // Artículos
  ARTICLE_CREATE: 'ARTICLE_CREATE',
  ARTICLE_UPDATE: 'ARTICLE_UPDATE',
  ARTICLE_DELETE: 'ARTICLE_DELETE',
  ARTICLE_STOCK_ADJUST: 'ARTICLE_STOCK_ADJUST',
  
  // Categorías
  CATEGORY_CREATE: 'CATEGORY_CREATE',
  CATEGORY_UPDATE: 'CATEGORY_UPDATE',
  CATEGORY_DELETE: 'CATEGORY_DELETE',
  
  // Condiciones de Pago
  PAYMENT_TERM_CREATE: 'PAYMENT_TERM_CREATE',
  PAYMENT_TERM_UPDATE: 'PAYMENT_TERM_UPDATE',
  PAYMENT_TERM_DELETE: 'PAYMENT_TERM_DELETE',
  
  // Certificados
  CERTIFICATE_SYNC: 'CERTIFICATE_SYNC',
  CERTIFICATE_DELETE: 'CERTIFICATE_DELETE',
  
  // Usuarios
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  
  // Sistema
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  
  // Precios
  PRICE_UPDATE: 'PRICE_UPDATE',
  PRICE_BULK_UPDATE: 'PRICE_BULK_UPDATE',
  PRICE_REVERT: 'PRICE_REVERT',
} as const;

export const OPERATION_LABELS: Record<string, string> = {
  ORDER_CREATE: 'Crear Pedido',
  ORDER_UPDATE: 'Modificar Pedido',
  ORDER_DELETE: 'Eliminar Pedido',
  INVOICE_CREATE: 'Crear Factura',
  INVOICE_UPDATE: 'Modificar Factura',
  INVOICE_DELETE: 'Eliminar Factura',
  INVOICE_PRINT: 'Imprimir Factura',
  INVOICE_CANCEL: 'Anular Factura',
  DELIVERY_CREATE: 'Crear Remito',
  DELIVERY_UPDATE: 'Modificar Remito',
  DELIVERY_DELETE: 'Eliminar Remito',
  DELIVERY_PRINT: 'Imprimir Remito',
  STOCK_ADJUST: 'Ajuste de Stock',
  CLIENT_CREATE: 'Crear Cliente',
  CLIENT_UPDATE: 'Modificar Cliente',
  CLIENT_DELETE: 'Eliminar Cliente',
  ARTICLE_CREATE: 'Crear Artículo',
  ARTICLE_UPDATE: 'Modificar Artículo',
  ARTICLE_DELETE: 'Eliminar Artículo',
  ARTICLE_STOCK_ADJUST: 'Ajuste de Stock de Artículo',
  CATEGORY_CREATE: 'Crear Categoría',
  CATEGORY_UPDATE: 'Modificar Categoría',
  CATEGORY_DELETE: 'Eliminar Categoría',
  PAYMENT_TERM_CREATE: 'Crear Condición de Pago',
  PAYMENT_TERM_UPDATE: 'Modificar Condición de Pago',
  PAYMENT_TERM_DELETE: 'Eliminar Condición de Pago',
  CERTIFICATE_SYNC: 'Sincronizar Certificados',
  CERTIFICATE_DELETE: 'Eliminar Certificado',
  USER_CREATE: 'Crear Usuario',
  USER_UPDATE: 'Modificar Usuario',
  USER_DEACTIVATE: 'Desactivar Usuario',
  SETTINGS_UPDATE: 'Configuración',
  LOGIN: 'Inicio de Sesión',
  LOGOUT: 'Cierre de Sesión',
  PRICE_UPDATE: 'Actualizar Precio',
  PRICE_BULK_UPDATE: 'Actualización Masiva de Precios',
  PRICE_REVERT: 'Revertir Precio',
};

