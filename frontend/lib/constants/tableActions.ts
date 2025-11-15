/**
 * Centralized configuration for table action buttons
 * This ensures consistent styling across all table components
 */

export const TABLE_ACTION_BUTTON_VARIANT = 'ghost' as const;
export const TABLE_ACTION_BUTTON_SIZE = 'icon' as const;

/**
 * Action button variants for different action types
 */
export const ACTION_BUTTON_CONFIG = {
  edit: {
    variant: TABLE_ACTION_BUTTON_VARIANT,
    size: TABLE_ACTION_BUTTON_SIZE,
    title: 'Editar',
  },
  delete: {
    variant: TABLE_ACTION_BUTTON_VARIANT,
    size: TABLE_ACTION_BUTTON_SIZE,
    title: 'Eliminar',
  },
  view: {
    variant: TABLE_ACTION_BUTTON_VARIANT,
    size: TABLE_ACTION_BUTTON_SIZE,
    title: 'Ver detalle',
  },
  print: {
    variant: TABLE_ACTION_BUTTON_VARIANT,
    size: TABLE_ACTION_BUTTON_SIZE,
    title: 'Imprimir',
  },
  cancel: {
    variant: TABLE_ACTION_BUTTON_VARIANT,
    size: TABLE_ACTION_BUTTON_SIZE,
    title: 'Cancelar',
  },
} as const;





























