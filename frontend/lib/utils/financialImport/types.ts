export type ImportSource = 'bank_extract' | 'planilla_diaria' | 'salarios';

export interface ParsedCostRow {
  yearMonth: string; // "2026-01"
  source: ImportSource;
  category: string;
  amountArs: number;
  amountUsd?: number;
  exchangeRate?: number;
  notes?: string;
}

export interface ParseResult {
  rows: ParsedCostRow[];
  summary: {
    monthsDetected: string[];
    totalRows: number;
    source: ImportSource;
  };
}

// Category labels for display
export const CATEGORY_LABELS: Record<string, string> = {
  // Bank extract
  income_checks: 'Acreditación Valores/Cheques',
  income_transfers: 'Transferencias Recibidas',
  diego_salary: 'Sueldo Diego',
  diego_credit_card: 'Tarjeta de Crédito',
  diego_education: 'Educación (Colegio)',
  diego_property: 'Inmobiliario / Propiedades',
  diego_transfers: 'Transferencias Personales',
  diego_payments: 'Pagos Personales',
  opex_salaries: 'Sueldos Personal',
  opex_arca: 'ARCA - Obligaciones Fiscales',
  opex_afip: 'AFIP - Débito Directo',
  opex_services: 'Servicios (Luz/Gas/Agua/Telecom)',
  opex_insurance: 'Mantenimiento Cuenta / Seguros',
  opex_municipal: 'Tasas Municipales',
  opex_var_taxes: 'Impuestos s/Actividad',
  opex_var_commissions: 'Comisiones Bancarias',
  // Planilla diaria
  negro_sueldos: 'Sueldos (efectivo)',
  negro_diego: 'Diego (efectivo)',
  negro_caja_chica: 'Caja Chica',
  negro_fletes: 'Fletes / Transporte',
  negro_otros: 'Otros (efectivo)',
  // Salarios
  payroll_total: 'Nómina Total',
  payroll_banco: 'Nómina Banco',
  payroll_efectivo: 'Nómina Efectivo',
  payroll_aguinaldo: 'Aguinaldo',
  payroll_exchange_rate: 'Tipo de Cambio',
};

export const SOURCE_LABELS: Record<ImportSource, string> = {
  bank_extract: 'Extracto Bancario',
  planilla_diaria: 'Planilla Diaria',
  salarios: 'Salarios',
};
