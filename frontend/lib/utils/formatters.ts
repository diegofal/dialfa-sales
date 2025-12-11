/**
 * Format CUIT in Argentine format: XX-XXXXXXXX-X
 * @param cuit - CUIT string (11 digits)
 * @returns Formatted CUIT or original value if invalid
 */
export function formatCuit(cuit: string | null | undefined): string {
  if (!cuit) return '-';
  
  // Remove any non-digit characters
  const cleanCuit = cuit.replace(/\D/g, '');
  
  // Check if it has 11 digits
  if (cleanCuit.length !== 11) {
    return cuit; // Return original if not 11 digits
  }
  
  // Format as XX-XXXXXXXX-X
  return `${cleanCuit.slice(0, 2)}-${cleanCuit.slice(2, 10)}-${cleanCuit.slice(10)}`;
}

/**
 * Format currency in Argentine Pesos
 * @param value - Numeric value
 * @returns Formatted currency string
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

/**
 * Format phone number
 * @param phone - Phone string
 * @returns Formatted phone or original value
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  return phone;
}

