import { useState, useCallback } from 'react';

export interface ValidationRule<T> {
  field: keyof T;
  validate: (value: any, formData: T) => string | null;
  message?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface UseFormValidationResult<T> {
  errors: Record<string, string>;
  validate: (data: T) => boolean;
  clearError: (field: keyof T) => void;
  clearAllErrors: () => void;
  setError: (field: keyof T, message: string) => void;
  hasError: (field: keyof T) => boolean;
  getError: (field: keyof T) => string | undefined;
}

/**
 * Generic form validation hook
 * @param rules Array of validation rules
 * @returns Validation state and methods
 * 
 * @example
 * const { errors, validate, clearError, hasError, getError } = useFormValidation([
 *   {
 *     field: 'clientId',
 *     validate: (value) => value ? null : 'Debe seleccionar un cliente',
 *   },
 *   {
 *     field: 'paymentTermId',
 *     validate: (value) => value ? null : 'Debe seleccionar una condición de pago',
 *   },
 * ]);
 */
export function useFormValidation<T extends Record<string, any>>(
  rules: ValidationRule<T>[]
): UseFormValidationResult<T> {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback((data: T): boolean => {
    const newErrors: Record<string, string> = {};
    
    for (const rule of rules) {
      const fieldValue = data[rule.field];
      const error = rule.validate(fieldValue, data);
      
      if (error) {
        newErrors[rule.field as string] = error;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [rules]);

  const clearError = useCallback((field: keyof T) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field as string];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const setError = useCallback((field: keyof T, message: string) => {
    setErrors(prev => ({ ...prev, [field as string]: message }));
  }, []);

  const hasError = useCallback((field: keyof T): boolean => {
    return !!(errors[field as string]);
  }, [errors]);

  const getError = useCallback((field: keyof T): string | undefined => {
    return errors[field as string];
  }, [errors]);

  return {
    errors,
    validate,
    clearError,
    clearAllErrors,
    setError,
    hasError,
    getError,
  };
}

/**
 * Common validation functions
 */
export const validators = {
  required: (message = 'Este campo es requerido') => (value: any) => {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      return message;
    }
    return null;
  },
  
  minLength: (min: number, message?: string) => (value: string) => {
    if (value && value.length < min) {
      return message || `Debe tener al menos ${min} caracteres`;
    }
    return null;
  },
  
  maxLength: (max: number, message?: string) => (value: string) => {
    if (value && value.length > max) {
      return message || `No puede exceder ${max} caracteres`;
    }
    return null;
  },
  
  min: (min: number, message?: string) => (value: number) => {
    if (value !== null && value !== undefined && value < min) {
      return message || `Debe ser mayor o igual a ${min}`;
    }
    return null;
  },
  
  max: (max: number, message?: string) => (value: number) => {
    if (value !== null && value !== undefined && value > max) {
      return message || `Debe ser menor o igual a ${max}`;
    }
    return null;
  },
  
  email: (message = 'Email inválido') => (value: string) => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return message;
    }
    return null;
  },
  
  pattern: (pattern: RegExp, message = 'Formato inválido') => (value: string) => {
    if (value && !pattern.test(value)) {
      return message;
    }
    return null;
  },
  
  custom: <T>(validator: (value: any, formData: T) => boolean, message: string) => (value: any, formData: T) => {
    if (!validator(value, formData)) {
      return message;
    }
    return null;
  },
};
