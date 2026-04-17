// ── API response types ──────────────────────────────────────────

export interface MonthlyData {
  mes: string;
  facturas: number;
  ordenes: number;
  net_usd: number;
  total_usd: number;
  // Merged from collections
  cobranza_usd: number;
  cobranza_ars: number;
  cobranza_rate: number;
  cobranza_n: number;
}

export interface CollectionData {
  mes: string;
  n: number;
  total_ars: number;
  total_usd: number;
  avg_rate: number;
  clientes: number;
}

export interface CostStats {
  articulos_facturados: number;
  articulos_con_costo: number;
  venta_total_usd: number;
  venta_cubierta_usd: number;
  fob_total_cubierto_usd: number;
  proformas_cargadas: number;
}

export interface TopClient {
  cliente: string;
  facturas: number;
  net_usd: number;
}

export interface TopProduct {
  code: string;
  descripcion: string;
  unidades: number;
  facturado_usd: number;
}

export interface FinancialAnalysisResponse {
  monthly: Array<{
    mes: string;
    facturas: number;
    ordenes: number;
    net_usd: number;
    total_usd: number;
  }>;
  collections: CollectionData[];
  topClients: TopClient[];
  topProducts: TopProduct[];
  costStats: CostStats;
}

// ── Cost anchor calculations ────────────────────────────────────

export interface CostAnchors {
  cmv_fob_pct: number;
  cmv_cif_pct: number;
  cmv_landed_pct: number;
  cobertura_pct: number;
  calidad: 'alta' | 'media' | 'baja';
  articulos_facturados: number;
  articulos_con_costo: number;
  proformas_cargadas: number;
  venta_cubierta_usd: number;
  venta_total_usd: number;
  fob_total_cubierto: number;
}

// ── Client-side config types ────────────────────────────────────

export interface PayrollRow {
  name: string;
  count: number;
  salary: number;
  participates: boolean;
}

export interface PayrollProfile {
  label: string;
  rows: PayrollRow[];
  aguinaldo_meses: number;
  pays_variable: boolean;
}

export type Profiles = {
  actual: PayrollProfile;
  propuesta: PayrollProfile;
};

export interface CompanyCosts {
  fixed_usd_month: number;
  variable_pct_sales: number;
  payroll_tax_pct: number;
  owner_draw_usd: number;
}

export interface SimulatorConfig {
  cmv_pct: number;
  variable_pct: number;
  target_window: number;
  payroll_cap_pct: number;
  cap_pct_salary: number;
  frequency: 'mensual' | 'trimestral' | 'semestral' | 'anual';
  source: 'facturacion' | 'cobranza';
  revenue_projected: number;
}

// ── Derived/summary types ───────────────────────────────────────

export interface MonthlySummary {
  months_count: number;
  avg_net_12m: number;
  avg_total_12m: number;
  avg_cob_12m: number;
  max_month: { mes: string; usd: number } | null;
  min_month: { mes: string; usd: number } | null;
  total_sales_12m: number;
  top1_pct: number;
  top5_pct: number;
  top10_pct: number;
}

// ── Calculation result types ────────────────────────────────────

export interface ProfileCalc {
  key: string;
  label: string;
  rows: PayrollRow[];
  aguinaldo_meses: number;
  pays_variable: boolean;
  fijo: number;
  participants: number;
  annual: number;
}

export interface PeriodDist {
  pool: number;
  pp: number;
  capPP: number;
  hit: boolean;
}

export interface Period {
  si: number;
  ei: number;
  months: number;
  exc: number;
  act: PeriodDist;
  prop: PeriodDist;
}

// ── Real monthly cost data (from imported Excel) ────────────────

export interface RealMonthlyCost {
  fixedCosts: number; // USD — empresa operational costs (excl. payroll)
  ownerDraw: number; // USD — Diego personal costs
  payroll: number; // USD — total nómina (from SALARIOS)
  variableCosts: number; // USD — variable operational costs
  exchangeRate: number; // ARS/USD for that month
}

// Map of yearMonth → real costs (undefined = use defaults)
export type RealCostsMap = Record<string, RealMonthlyCost>;

export interface CalcRow {
  mes: string;
  rev: number;
  revFact: number;
  revCob: number;
  cmvU: number;
  mb: number;
  cv: number;
  mo: number;
  projected: boolean;
  // Real cost fields
  realCostoFijo: number;
  realOwnerDraw: number;
  realPayroll: number;
  hasRealCosts: boolean;
  // Period/variable fields
  exc: number;
  poolA: number;
  poolP: number;
  nomA: number;
  nomP: number;
  pctA: number;
  pctP: number;
  delta: number;
  isEnd: boolean;
  pi: number;
  capHit: boolean;
}

export interface CalcResult {
  cmv: number;
  pct: number;
  winN: number;
  capTot: number;
  capPerson: number;
  costoFijo: number;
  costoVarPct: number;
  ownerDraw: number;
  payrollTax: number;
  freq: string;
  freqN: number;
  src: string;
  target: number;
  rows: CalcRow[];
  act: ProfileCalc;
  prop: ProfileCalc;
  periods: Period[];
}
