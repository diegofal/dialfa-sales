'use client';

import * as React from 'react';
import { TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface ClickableTableRowProps extends React.ComponentProps<typeof TableRow> {
  /**
   * Handler que se ejecuta al hacer click en la fila
   */
  onRowClick: () => void;
  /**
   * Si está deshabilitada, no se ejecuta el click ni se muestra como clickeable
   */
  disabled?: boolean;
}

/**
 * Componente TableRow clickeable que ejecuta una acción al hacer click en la fila.
 * Previene la ejecución si el click fue en un elemento interactivo (botón, link, input, etc.)
 *
 * @example
 * ```tsx
 * <ClickableTableRow
 *   onRowClick={() => onView(item.id)}
 *   aria-label={`Ver detalles de ${item.name}`}
 * >
 *   <TableCell>{item.name}</TableCell>
 *   <TableCell>
 *     <Button onClick={onEdit}>Editar</Button>
 *   </TableCell>
 * </ClickableTableRow>
 * ```
 */
export function ClickableTableRow({
  onRowClick,
  disabled = false,
  className,
  children,
  ...props
}: ClickableTableRowProps) {
  const handleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    console.log('ClickableTableRow handleClick called', { disabled, target: e.target });

    // No ejecutar si está deshabilitada
    if (disabled) {
      console.log('Row is disabled, skipping');
      return;
    }

    // No ejecutar si el click fue en un elemento interactivo
    const target = e.target as HTMLElement;

    // Verificar si el click fue dentro de un botón, link o input
    const isInteractive = target.closest('button, a, input, select, textarea');

    if (isInteractive) {
      console.log('Click was on interactive element, skipping:', isInteractive.tagName);
      return;
    }

    console.log('Row clicked, executing onRowClick');
    onRowClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    // Soportar navegación por teclado (Enter o Space)
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick();
    }
  };

  return (
    <TableRow
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? undefined : 0}
      role="button"
      className={cn(
        // Estilos cuando está habilitada
        !disabled && [
          'cursor-pointer',
          'hover:bg-muted/70',
          'active:bg-muted',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        ],
        // Estilos cuando está deshabilitada
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
      {...props}
    >
      {children}
    </TableRow>
  );
}
