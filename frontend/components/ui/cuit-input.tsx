'use client';

import * as React from 'react';
import { Input } from './input';

export interface CUITInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  'onChange' | 'value'
> {
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * Componente de input para CUIT con formato automático XX-XXXXXXXX-X
 *
 * @example
 * ```tsx
 * <CUITInput
 *   value={cuit}
 *   onChange={(value) => setCuit(value)}
 *   placeholder="20-12345678-9"
 * />
 * ```
 */
export function CUITInput({ value = '', onChange, ...props }: CUITInputProps) {
  const [displayValue, setDisplayValue] = React.useState('');

  // Formatear CUIT: XX-XXXXXXXX-X
  const formatCUIT = (input: string): string => {
    // Remover todo excepto números
    const numbers = input.replace(/\D/g, '');

    // Limitar a 11 dígitos
    const limited = numbers.slice(0, 11);

    // Aplicar formato
    if (limited.length <= 2) {
      return limited;
    } else if (limited.length <= 10) {
      return `${limited.slice(0, 2)}-${limited.slice(2)}`;
    } else {
      return `${limited.slice(0, 2)}-${limited.slice(2, 10)}-${limited.slice(10)}`;
    }
  };

  // Remover formato para valor limpio (solo números)
  const unformatCUIT = (formatted: string): string => {
    return formatted.replace(/\D/g, '');
  };

  // Sincronizar displayValue con value prop
  React.useEffect(() => {
    const cleanValue = unformatCUIT(value);
    setDisplayValue(formatCUIT(cleanValue));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatCUIT(inputValue);
    const clean = unformatCUIT(formatted);

    setDisplayValue(formatted);

    // Llamar onChange con el valor limpio (sin guiones)
    if (onChange) {
      onChange(clean);
    }
  };

  return (
    <Input
      {...props}
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder={props.placeholder || '20-12345678-9'}
      maxLength={13} // XX-XXXXXXXX-X = 13 caracteres
    />
  );
}
