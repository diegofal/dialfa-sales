import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a CUIT string to Argentine format: XX-XXXXXXXX-X
 * @param cuit - CUIT string (may contain hyphens or be digits only)
 * @returns Formatted CUIT string or original if invalid/empty
 * @example
 * formatCuit("20305994740") // "20-30599474-0"
 * formatCuit("20-30599474-0") // "20-30599474-0"
 */
export function formatCuit(cuit: string | null | undefined): string {
  if (!cuit) return '';

  // Remove all non-digit characters
  const digitsOnly = cuit.replace(/\D/g, '');

  // CUIT must be exactly 11 digits
  if (digitsOnly.length !== 11) {
    // Return original if not valid CUIT format
    return cuit;
  }

  // Format as XX-XXXXXXXX-X
  return `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 10)}-${digitsOnly.slice(10)}`;
}
