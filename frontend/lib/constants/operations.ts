export const OPERATIONS = {
  // Pedidos
  ORDER_CREATE: 'ORDER_CREATE',
  ORDER_UPDATE: 'ORDER_UPDATE',
  ORDER_DELETE: 'ORDER_DELETE',
  
  // Facturas
  INVOICE_CREATE: 'INVOICE_CREATE',
  INVOICE_PRINT: 'INVOICE_PRINT',
  INVOICE_CANCEL: 'INVOICE_CANCEL',
  
  // Remitos
  DELIVERY_CREATE: 'DELIVERY_CREATE',
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
  
  // Usuarios
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  
  // Sistema
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
} as const;

export const OPERATION_LABELS: Record<string, string> = {
  ORDER_CREATE: 'Crear Pedido',
  ORDER_UPDATE: 'Modificar Pedido',
  ORDER_DELETE: 'Eliminar Pedido',
  INVOICE_CREATE: 'Crear Factura',
  INVOICE_PRINT: 'Imprimir Factura',
  INVOICE_CANCEL: 'Anular Factura',
  DELIVERY_CREATE: 'Crear Remito',
  DELIVERY_PRINT: 'Imprimir Remito',
  STOCK_ADJUST: 'Ajuste de Stock',
  CLIENT_CREATE: 'Crear Cliente',
  CLIENT_UPDATE: 'Modificar Cliente',
  CLIENT_DELETE: 'Eliminar Cliente',
  ARTICLE_CREATE: 'Crear Artículo',
  ARTICLE_UPDATE: 'Modificar Artículo',
  ARTICLE_DELETE: 'Eliminar Artículo',
  USER_CREATE: 'Crear Usuario',
  USER_UPDATE: 'Modificar Usuario',
  USER_DEACTIVATE: 'Desactivar Usuario',
  SETTINGS_UPDATE: 'Configuración',
  LOGIN: 'Inicio de Sesión',
  LOGOUT: 'Cierre de Sesión',
};

