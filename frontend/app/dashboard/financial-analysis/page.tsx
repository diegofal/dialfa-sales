'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ControlsPanel } from '@/components/financialAnalysis/ControlsPanel';
import { CostDataPanel } from '@/components/financialAnalysis/CostDataPanel';
import { DataSourceBadge } from '@/components/financialAnalysis/DataSourceBadge';
import { ImportDialog } from '@/components/financialAnalysis/ImportDialog';
import { KpiCards } from '@/components/financialAnalysis/KpiCards';
import { MonthlyTable } from '@/components/financialAnalysis/MonthlyTable';
import { PLTable } from '@/components/financialAnalysis/PLTable';
import { RecommendationBanner } from '@/components/financialAnalysis/RecommendationBanner';
import { Spinner } from '@/components/ui/spinner';
import { useFinancialAnalysis } from '@/lib/hooks/domain/useFinancialAnalysis';
import { useImportedCosts } from '@/lib/hooks/domain/useFinancialAnalysis';
import {
  calculate,
  computeCostAnchors,
  computeSummary,
  computeKpis,
  computeRecommendation,
  computePL,
  mergeMonthlyData,
  aggregateImportedCosts,
} from '@/lib/utils/financialCalc';
import { SimulatorCharts } from '@/components/financialAnalysis/SimulatorCharts';
import { TopClientsTable } from '@/components/financialAnalysis/TopClientsTable';
import { TopProductsTable } from '@/components/financialAnalysis/TopProductsTable';
import { useAuthStore } from '@/store/authStore';
import type { Profiles, CompanyCosts, SimulatorConfig } from '@/types/financialAnalysis';

// ── LocalStorage keys ───────────────────────────────────────────

const LS_CONFIG = 'spisa_fin_config';
const LS_PROFILES = 'spisa_fin_profiles';

// ── Defaults (matching Python simulator) ────────────────────────

const DEFAULT_PROFILES: Profiles = {
  actual: {
    label: 'Actual',
    rows: [
      { name: 'Junior', count: 1, salary: 1000, participates: false },
      { name: 'Mid', count: 2, salary: 1500, participates: true },
      { name: 'Top', count: 2, salary: 2000, participates: true },
    ],
    aguinaldo_meses: 1,
    pays_variable: false,
  },
  propuesta: {
    label: 'Propuesta',
    rows: [
      { name: 'Rodri', count: 1, salary: 1100, participates: false },
      { name: 'Charly', count: 1, salary: 1750, participates: true },
      { name: 'Claudito', count: 1, salary: 2000, participates: true },
      { name: 'Dani y Pela', count: 2, salary: 2500, participates: true },
    ],
    aguinaldo_meses: 1,
    pays_variable: true,
  },
};

const DEFAULT_COSTS: CompanyCosts = {
  fixed_usd_month: 12800,
  variable_pct_sales: 8,
  payroll_tax_pct: 40,
  owner_draw_usd: 15800,
};

const DEFAULT_CONFIG: SimulatorConfig = {
  cmv_pct: 32.4,
  variable_pct: 5,
  target_window: 12,
  payroll_cap_pct: 30,
  cap_pct_salary: 50,
  frequency: 'trimestral',
  source: 'cobranza',
  revenue_projected: 0,
};

// ── LocalStorage helpers ────────────────────────────────────────

function loadProfiles(): Profiles {
  try {
    const s = localStorage.getItem(LS_PROFILES);
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed?.actual?.rows && parsed?.propuesta?.rows) return parsed;
    }
  } catch {
    // ignore
  }
  return structuredClone(DEFAULT_PROFILES);
}

function loadConfig(): { costs: CompanyCosts; config: SimulatorConfig } {
  try {
    const s = localStorage.getItem(LS_CONFIG);
    if (s) {
      const parsed = JSON.parse(s);
      return {
        costs: { ...DEFAULT_COSTS, ...parsed.costs },
        config: { ...DEFAULT_CONFIG, ...parsed.config },
      };
    }
  } catch {
    // ignore
  }
  return { costs: { ...DEFAULT_COSTS }, config: { ...DEFAULT_CONFIG } };
}

// ── Page component ──────────────────────────────────────────────

export default function FinancialAnalysisPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const { data: raw, isLoading, error } = useFinancialAnalysis();
  const { data: importedCosts, invalidate: refreshCosts } = useImportedCosts();

  // State — initialized from localStorage
  const [profiles, setProfiles] = useState<Profiles>(() => loadProfiles());
  const [costs, setCosts] = useState<CompanyCosts>(() => loadConfig().costs);
  const [config, setConfig] = useState<SimulatorConfig>(() => loadConfig().config);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(LS_PROFILES, JSON.stringify(profiles));
    } catch {
      // ignore
    }
  }, [profiles]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CONFIG, JSON.stringify({ costs, config }));
    } catch {
      // ignore
    }
  }, [costs, config]);

  // Derived data
  const monthly = useMemo(() => {
    if (!raw) return [];
    return mergeMonthlyData(raw.monthly, raw.collections);
  }, [raw]);

  const costAnchors = useMemo(() => {
    if (!raw) return null;
    return computeCostAnchors(raw.costStats);
  }, [raw]);

  // Initialize CMV from calculated cost anchors when data arrives (if no localStorage override)
  const [cmvInitialized, setCmvInitialized] = useState(false);
  useEffect(() => {
    if (costAnchors && !cmvInitialized) {
      setCmvInitialized(true);
      // Only override if no localStorage was loaded (i.e. config still has the hardcoded default)
      const saved = localStorage.getItem(LS_CONFIG);
      if (!saved) {
        setConfig((prev) => ({ ...prev, cmv_pct: costAnchors.cmv_landed_pct }));
      }
    }
  }, [costAnchors, cmvInitialized]);

  // Reset all — uses calculated CMV, not hardcoded
  const handleResetAll = useCallback(() => {
    localStorage.removeItem(LS_CONFIG);
    localStorage.removeItem(LS_PROFILES);
    setProfiles(structuredClone(DEFAULT_PROFILES));
    setCosts({ ...DEFAULT_COSTS });
    setConfig({
      ...DEFAULT_CONFIG,
      cmv_pct: costAnchors?.cmv_landed_pct ?? DEFAULT_CONFIG.cmv_pct,
    });
  }, [costAnchors]);

  const summary = useMemo(() => {
    if (!raw || monthly.length === 0) return null;
    return computeSummary(monthly, raw.topClients);
  }, [raw, monthly]);

  // Aggregate imported costs into per-month USD values
  const realCosts = useMemo(() => {
    if (!importedCosts?.costs) return undefined;
    return aggregateImportedCosts(importedCosts.costs);
  }, [importedCosts]);

  // Core calculation (mirrors simulator's calc())
  const calcResult = useMemo(() => {
    if (monthly.length === 0) return null;
    return calculate(monthly, profiles, costs, config, realCosts);
  }, [monthly, profiles, costs, config, realCosts]);

  // KPIs
  const kpis = useMemo(() => {
    if (!calcResult || !summary) return null;
    return computeKpis(calcResult, summary);
  }, [calcResult, summary]);

  // Recommendation
  const recommendation = useMemo(() => {
    if (!calcResult) return null;
    return computeRecommendation(calcResult);
  }, [calcResult]);

  // P&L
  const pl = useMemo(() => {
    if (!calcResult) return null;
    return computePL(calcResult);
  }, [calcResult]);

  if (!isAdmin) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground text-lg">Acceso denegado — solo administradores</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !raw || !costAnchors || !summary || !calcResult || !kpis || !recommendation || !pl) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-destructive">Error al cargar datos financieros</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">DIALFA - Simulador Variable</h1>
          <p className="text-muted-foreground text-[11px]">
            datos reales 18m | {summary.months_count} meses
          </p>
        </div>
        <ImportDialog onImportComplete={refreshCosts} />
      </div>

      <DataSourceBadge rows={calcResult.rows} />

      <KpiCards kpis={kpis} />

      <ControlsPanel
        profiles={profiles}
        costs={costs}
        config={config}
        costAnchors={costAnchors}
        onProfilesChange={setProfiles}
        onCostsChange={setCosts}
        onConfigChange={setConfig}
        onResetAll={handleResetAll}
        realMonthsCount={pl.realMonths}
      />

      <RecommendationBanner data={recommendation} />

      <PLTable
        rows={pl.rows}
        hasProjected={pl.hasProjected}
        projectedRevenue={pl.projectedRevenue}
        hasRealCosts={pl.hasRealCosts}
        realMonths={pl.realMonths}
        totalMonths={pl.totalMonths}
      />

      <MonthlyTable rows={calcResult.rows} />

      <SimulatorCharts calcResult={calcResult} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopClientsTable data={raw.topClients} totalSales12m={summary.total_sales_12m} />
        <TopProductsTable data={raw.topProducts} />
      </div>

      {importedCosts && <CostDataPanel costs={importedCosts.costs} months={importedCosts.months} />}

      <div className="text-muted-foreground border-border border-t pt-2 text-center text-[10px]">
        Fuente: base Railway | facturas emitidas (excl. NC/cotiz./canceladas) | valores en USD
        post-descuento
      </div>
    </div>
  );
}
