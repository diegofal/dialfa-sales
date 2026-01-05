import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  htmlFor?: string;
  description?: string;
  className?: string;
}

/**
 * Reusable form field wrapper with label, error display, and description
 * 
 * @example
 * <FormField 
 *   label="Condición de Pago" 
 *   required 
 *   error={getError('paymentTermId')}
 *   description="Define descuentos por categoría"
 * >
 *   <Select>...</Select>
 * </FormField>
 */
export function FormField({
  label,
  error,
  required,
  children,
  htmlFor,
  description,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label 
        htmlFor={htmlFor}
        className={cn(
          error && 'text-destructive'
        )}
      >
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <div className={cn(
        'transition-all',
        error && 'animate-shake'
      )}>
        {children}
      </div>
      
      {error && (
        <p className="text-sm font-medium text-destructive animate-in fade-in-50 slide-in-from-top-1">
          {error}
        </p>
      )}
      
      {!error && description && (
        <p className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
