import type {
  MonthlyData,
  CompanyCosts,
  SimulatorConfig,
  Profiles,
  ProfileCalc,
  Period,
  PeriodDist,
  CalcRow,
  CalcResult,
  CostAnchors,
  CostStats,
  MonthlySummary,
  CollectionData,
  RealCostsMap,
} from '@/types/financialAnalysis';

const FREQ_MAP: Record<string, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

// ── Profile helpers ─────────────────────────────────────────────

function readProfile(p: Profiles[keyof Profiles], key: string): ProfileCalc {
  const fijo = p.rows.reduce((a, r) => a + r.count * r.salary, 0);
  const participants = p.rows.reduce((a, r) => a + (r.participates ? r.count : 0), 0);
  return {
    key,
    label: p.label,
    rows: p.rows,
    aguinaldo_meses: p.aguinaldo_meses,
    pays_variable: p.pays_variable,
    fijo,
    participants,
    annual: fijo * (12 + p.aguinaldo_meses),
  };
}

// ── Cost anchors from raw stats ─────────────────────────────────

export function computeCostAnchors(costStats: CostStats): CostAnchors {
  const venta = costStats.venta_cubierta_usd || 0;
  const fob = costStats.fob_total_cubierto_usd || 0;
  const total = costStats.venta_total_usd || 0;

  const fobPct = venta > 0 ? Math.round(((100 * fob) / venta) * 10) / 10 : 0;
  const cifPct = Math.round(fobPct * 1.5 * 10) / 10;
  const landedPct = Math.round(fobPct * 1.8 * 10) / 10;
  const coberturaPct = total > 0 ? Math.round(((100 * venta) / total) * 10) / 10 : 0;

  return {
    cmv_fob_pct: fobPct,
    cmv_cif_pct: cifPct,
    cmv_landed_pct: landedPct,
    cobertura_pct: coberturaPct,
    calidad: coberturaPct >= 60 ? 'alta' : coberturaPct >= 30 ? 'media' : 'baja',
    articulos_facturados: costStats.articulos_facturados || 0,
    articulos_con_costo: costStats.articulos_con_costo || 0,
    proformas_cargadas: costStats.proformas_cargadas || 0,
    venta_cubierta_usd: Math.round(venta),
    venta_total_usd: Math.round(total),
    fob_total_cubierto: Math.round(fob),
  };
}

// ── Monthly summary ─────────────────────────────────────────────

export function computeSummary(
  monthly: MonthlyData[],
  topClients: { net_usd: number }[]
): MonthlySummary {
  const last12 = monthly.slice(-12);
  const len = Math.max(last12.length, 1);
  const avgNet = last12.reduce((s, m) => s + m.net_usd, 0) / len;
  const avgTotal = last12.reduce((s, m) => s + m.total_usd, 0) / len;
  const avgCob = last12.reduce((s, m) => s + m.cobranza_usd, 0) / len;
  const totalSales = last12.reduce((s, m) => s + m.net_usd, 0);
  const maxM = last12.length > 0 ? last12.reduce((a, b) => (b.net_usd > a.net_usd ? b : a)) : null;
  const minM = last12.length > 0 ? last12.reduce((a, b) => (b.net_usd < a.net_usd ? b : a)) : null;

  const pct = (part: number) =>
    totalSales > 0 ? Math.round(((100 * part) / totalSales) * 10) / 10 : 0;
  const top1 = topClients[0]?.net_usd || 0;
  const top5 = topClients.slice(0, 5).reduce((s, c) => s + c.net_usd, 0);
  const top10 = topClients.slice(0, 10).reduce((s, c) => s + c.net_usd, 0);

  return {
    months_count: monthly.length,
    avg_net_12m: Math.round(avgNet),
    avg_total_12m: Math.round(avgTotal),
    avg_cob_12m: Math.round(avgCob),
    max_month: maxM ? { mes: maxM.mes, usd: Math.round(maxM.net_usd) } : null,
    min_month: minM ? { mes: minM.mes, usd: Math.round(minM.net_usd) } : null,
    total_sales_12m: Math.round(totalSales),
    top1_pct: pct(top1),
    top5_pct: pct(top5),
    top10_pct: pct(top10),
  };
}

// ── Merge monthly + collections ─────────────────────────────────

export function mergeMonthlyData(
  monthly: Array<{
    mes: string;
    facturas: number;
    ordenes: number;
    net_usd: number;
    total_usd: number;
  }>,
  collections: CollectionData[]
): MonthlyData[] {
  const collMap = new Map(collections.map((c) => [c.mes, c]));
  return monthly.map((m) => {
    const coll = collMap.get(m.mes);
    return {
      ...m,
      cobranza_usd: coll?.total_usd ?? 0,
      cobranza_ars: coll?.total_ars ?? 0,
      cobranza_rate: coll?.avg_rate ?? 0,
      cobranza_n: coll?.n ?? 0,
    };
  });
}

// ── Aggregate imported costs into per-month USD values ───────────

interface ImportedCostRow {
  year_month: string;
  source: string;
  category: string;
  amount_ars: number;
  amount_usd: number | null;
  exchange_rate: number | null;
}

/**
 * Aggregate imported cost rows into RealCostsMap (USD per month).
 *
 * Mapping logic (avoids double-counting):
 * - **Payroll**: SALARIOS.payroll_total (authoritative, includes bank + cash)
 * - **Fixed costs**: Bank opex (excl opex_salaries to avoid overlap with payroll)
 *                  + Planilla negro (excl negro_sueldos for same reason, excl negro_diego)
 * - **Owner draw**: Bank diego_* + Planilla negro_diego
 * - **Variable costs**: Bank opex_var_*
 */
export function aggregateImportedCosts(
  costsByMonth: Record<string, ImportedCostRow[]>
): RealCostsMap {
  const result: RealCostsMap = {};

  for (const [yearMonth, rows] of Object.entries(costsByMonth)) {
    // Get exchange rate from SALARIOS (most reliable)
    const tcRow = rows.find(
      (r) => r.source === 'salarios' && r.category === 'payroll_exchange_rate'
    );
    const tc = tcRow?.exchange_rate || tcRow?.amount_usd || null;
    if (!tc || tc <= 0) continue; // Can't convert without TC

    const toUsd = (ars: number) => ars / tc;

    let fixedCosts = 0;
    let ownerDraw = 0;
    let payroll = 0;
    let variableCosts = 0;

    for (const row of rows) {
      const ars = row.amount_ars || 0;
      if (ars === 0 && row.category !== 'payroll_exchange_rate') continue;

      const { source, category } = row;

      if (source === 'salarios') {
        if (category === 'payroll_total') payroll = toUsd(ars);
        if (category === 'payroll_aguinaldo') payroll += toUsd(ars);
        // payroll_banco, payroll_efectivo are sub-breakdowns, skip to avoid double count
      } else if (source === 'bank_extract') {
        // Owner draw: all diego_* categories
        if (category.startsWith('diego_')) {
          ownerDraw += toUsd(ars);
        }
        // Fixed costs: opex excluding salaries (already in payroll from SALARIOS)
        else if (category.startsWith('opex_') && category !== 'opex_salaries') {
          if (category === 'opex_var_taxes' || category === 'opex_var_commissions') {
            variableCosts += toUsd(ars);
          } else {
            fixedCosts += toUsd(ars);
          }
        }
      } else if (source === 'planilla_diaria') {
        // negro_sueldos already in SALARIOS.payroll_total, skip
        if (category === 'negro_diego') {
          ownerDraw += toUsd(ars);
        } else if (category !== 'negro_sueldos') {
          // caja_chica, fletes, otros → fixed costs
          fixedCosts += toUsd(ars);
        }
      }
    }

    result[yearMonth] = {
      fixedCosts: Math.round(fixedCosts),
      ownerDraw: Math.round(ownerDraw),
      payroll: Math.round(payroll),
      variableCosts: Math.round(variableCosts),
      exchangeRate: tc,
    };
  }

  return result;
}

// ── Core simulator calculation (mirrors JS calc()) ──────────────

export function calculate(
  monthly: MonthlyData[],
  profiles: Profiles,
  costs: CompanyCosts,
  config: SimulatorConfig,
  realCosts?: RealCostsMap
): CalcResult {
  const cmv = config.cmv_pct / 100;
  const pct = config.variable_pct / 100;
  const winN = config.target_window;
  const capTot = config.payroll_cap_pct / 100;
  const capPerson = config.cap_pct_salary / 100;
  const costoFijo = costs.fixed_usd_month;
  const costoVarPct = costs.variable_pct_sales / 100;
  const ownerDraw = costs.owner_draw_usd;
  const payrollTax = costs.payroll_tax_pct / 100;
  const freq = config.frequency;
  const freqN = FREQ_MAP[freq] || 3;
  const src = config.source;

  // Helper: get costs for a specific month (real if available, else defaults)
  const getCosts = (mes: string) => {
    const rc = realCosts?.[mes];
    if (rc) {
      return {
        fijo: rc.fixedCosts,
        varPct: rc.variableCosts > 0 ? 0 : costoVarPct, // if we have real var costs, use them directly
        varFixed: rc.variableCosts, // real variable costs as fixed USD amount
        draw: rc.ownerDraw,
        hasReal: true,
        realPayroll: rc.payroll,
      };
    }
    return {
      fijo: costoFijo,
      varPct: costoVarPct,
      varFixed: 0,
      draw: ownerDraw,
      hasReal: false,
      realPayroll: 0,
    };
  };

  const act = readProfile(profiles.actual, 'actual');
  const prop = readProfile(profiles.propuesta, 'propuesta');

  // Build months: real + projected
  const realMonths = monthly.map((m) => ({ ...m, projected: false }));
  const allMonths = [...realMonths];

  if (config.revenue_projected > 0) {
    const lastMes = realMonths.length > 0 ? realMonths[realMonths.length - 1].mes : '2026-03';
    const [ly, lm] = lastMes.split('-').map(Number);
    for (let i = 1; i <= 12; i++) {
      const nm = lm + i;
      const ny = ly + Math.floor((nm - 1) / 12);
      const mm = ((nm - 1) % 12) + 1;
      const mes = ny + '-' + (mm < 10 ? '0' : '') + mm;
      allMonths.push({
        mes,
        net_usd: config.revenue_projected,
        cobranza_usd: config.revenue_projected,
        facturas: 0,
        ordenes: 0,
        total_usd: config.revenue_projected * 1.21,
        cobranza_ars: 0,
        cobranza_rate: 0,
        cobranza_n: 0,
        projected: true,
      } as MonthlyData & { projected: boolean });
    }
  }

  const rev = (m: MonthlyData) => (src === 'cobranza' ? m.cobranza_usd || 0 : m.net_usd || 0);
  const opMargin = (m: MonthlyData) => {
    const mc = getCosts(m.mes);
    const r = rev(m);
    const cv = mc.hasReal ? mc.varFixed : r * mc.varPct;
    return r * (1 - cmv) - cv - mc.fijo - mc.draw;
  };

  // Target from real months only
  const realForTarget = realMonths.slice(-winN);
  const avgOp =
    realForTarget.reduce((a, m) => a + opMargin(m), 0) / Math.max(realForTarget.length, 1);
  const target = avgOp;

  // Base rows
  const base = allMonths.map((m) => {
    const mc = getCosts(m.mes);
    const r = rev(m);
    const cmvU = r * cmv;
    const mb = r - cmvU;
    const cv = mc.hasReal ? mc.varFixed : r * mc.varPct;
    const mo = mb - mc.fijo - cv - mc.draw;
    return {
      mes: m.mes,
      rev: r,
      revFact: m.net_usd || 0,
      revCob: m.cobranza_usd || 0,
      cmvU,
      mb,
      cv,
      mo,
      projected: !!(m as MonthlyData & { projected?: boolean }).projected,
      realCostoFijo: mc.fijo,
      realOwnerDraw: mc.draw,
      realPayroll: mc.realPayroll,
      hasRealCosts: mc.hasReal,
    };
  });

  // Period grouping
  const periods: Period[] = [];
  for (let end = base.length; end > 0; end -= freqN) {
    const start = Math.max(0, end - freqN);
    const sl = base.slice(start, end);
    const sumMo = sl.reduce((a, r) => a + r.mo, 0);
    const pTarget = target * sl.length;
    const exc = Math.max(0, sumMo - pTarget);

    function dist(profile: ProfileCalc): PeriodDist {
      if (!profile.pays_variable || profile.participants === 0)
        return { pool: 0, pp: 0, capPP: 0, hit: false };
      const ppRaw = exc * pct;
      const avgSal =
        profile.rows.filter((r) => r.participates).reduce((a, r) => a + r.count * r.salary, 0) /
        profile.participants;
      const capPP = capPerson * avgSal * sl.length;
      const pp = Math.min(ppRaw, capPP);
      return { pool: pp * profile.participants, pp, capPP, hit: ppRaw > capPP };
    }

    periods.unshift({
      si: start,
      ei: end - 1,
      months: sl.length,
      exc,
      act: dist(act),
      prop: dist(prop),
    });
  }

  // Map month index to period
  const m2p = new Map<number, { p: Period; last: boolean; pi: number }>();
  periods.forEach((p, pi) => {
    for (let i = p.si; i <= p.ei; i++) m2p.set(i, { p, last: i === p.ei, pi });
  });

  // Final rows
  const rows: CalcRow[] = base.map((b, i) => {
    const info = m2p.get(i)!;
    const pd = info.p;
    const isEnd = info.last;
    const poolA = isEnd ? pd.act.pool : 0;
    const poolP = isEnd ? pd.prop.pool : 0;
    const nomA = (act.fijo + poolA) * (1 + payrollTax);
    const nomP = (prop.fijo + poolP) * (1 + payrollTax);
    return {
      ...b,
      exc: isEnd ? pd.exc : 0,
      poolA,
      poolP,
      nomA,
      nomP,
      pctA: b.rev > 0 ? nomA / b.rev : 0,
      pctP: b.rev > 0 ? nomP / b.rev : 0,
      delta: nomP - nomA,
      isEnd,
      pi: info.pi,
      capHit: isEnd && pd.prop.hit,
    };
  });

  return {
    cmv,
    pct,
    winN,
    capTot,
    capPerson,
    costoFijo,
    costoVarPct,
    ownerDraw,
    payrollTax,
    freq,
    freqN,
    src,
    target,
    rows,
    act,
    prop,
    periods,
  };
}

// ── KPI derivation (mirrors renderKpis) ─────────────────────────

export function computeKpis(R: CalcResult, summary: MonthlySummary) {
  const l12 = R.rows.slice(-12);
  const totRev = l12.reduce((a, r) => a + r.rev, 0);
  const totMb = l12.reduce((a, r) => a + r.mb, 0);
  const totMo = l12.reduce((a, r) => a + r.mo, 0);

  // Break-even
  const contribR = totRev > 0 ? (totRev - l12.reduce((a, r) => a + r.cmvU + r.cv, 0)) / totRev : 0;
  const overhead =
    (R.costoFijo + R.ownerDraw) * 12 +
    R.prop.fijo * (12 + R.prop.aguinaldo_meses) * (1 + R.payrollTax);
  const be = contribR > 0 ? overhead / contribR : 0;

  // Utilidad propuesta
  const nomPropAn =
    l12.reduce((a, r) => a + r.nomP, 0) + R.prop.fijo * R.prop.aguinaldo_meses * (1 + R.payrollTax);
  const util = totMo - nomPropAn;

  const avgCob = summary.avg_cob_12m || summary.avg_net_12m;

  return {
    avgCob,
    maxMonth: summary.max_month,
    grossMarginPct: totRev > 0 ? totMb / totRev : 0,
    grossMarginAnnual: totMb,
    breakEvenMonthly: be / 12,
    breakEvenAnnual: be,
    utilidadPropuesta: util,
  };
}

// ── Recommendation (mirrors renderRec) ──────────────────────────

export function computeRecommendation(R: CalcResult) {
  const { prop, periods, pct, capPerson, freqN } = R;
  if (!prop.pays_variable || prop.participants === 0) {
    return {
      message: 'Sin participantes en la propuesta. Activa "Paga variable" y marca participantes.',
      maxPct: 0,
      ppAvg: 0,
      avgSal: 0,
      capPeriod: 0,
    };
  }

  const avgSal =
    prop.rows.filter((r) => r.participates).reduce((a, r) => a + r.count * r.salary, 0) /
    prop.participants;

  let maxPct = 30;
  periods.forEach((p) => {
    if (p.exc > 0) {
      const capPP = capPerson * avgSal * p.months;
      const fitPct = capPP / p.exc;
      if (fitPct < maxPct) maxPct = fitPct;
    }
  });
  maxPct = Math.min(maxPct, 30);

  const ppAvg =
    periods.length > 0 ? periods.reduce((a, p) => a + p.prop.pp, 0) / periods.length : 0;

  return {
    message: null,
    maxPct,
    ppAvg,
    avgSal,
    capPeriod: capPerson * avgSal * freqN,
    pctActual: pct,
    participants: prop.participants,
    freq: R.freq,
  };
}

// ── P&L Annual (mirrors renderPL) ───────────────────────────────

export interface PLRow {
  label: string;
  actual: number;
  propuesta: number;
  delta: number;
  isPct?: boolean;
  isBold?: boolean;
  isHighlight?: boolean;
  /** 'real' = all source months have imported data, 'mixed' = some, 'estimated' = none/na */
  dataSource?: 'real' | 'mixed' | 'estimated';
}

export function computePL(R: CalcResult): {
  rows: PLRow[];
  hasProjected: boolean;
  projectedRevenue: number;
  hasRealCosts: boolean;
  realMonths: number;
  totalMonths: number;
} {
  const l12 = R.rows.slice(-12);
  const totRevA = l12.reduce((a, r) => a + r.rev, 0);
  const totCmvA = l12.reduce((a, r) => a + r.cmvU, 0);
  const totMbA = totRevA - totCmvA;
  // Use per-month costs (real where available, defaults where not)
  const totCf = l12.reduce((a, r) => a + r.realCostoFijo, 0);
  const totCv = l12.reduce((a, r) => a + r.cv, 0);
  const totDraw = l12.reduce((a, r) => a + r.realOwnerDraw, 0);
  const totMoA = totMbA - totCf - totCv - totDraw;
  const realMonths = l12.filter((r) => r.hasRealCosts).length;
  const totalMonths = l12.length;
  const hasRealData = realMonths > 0;
  const costSource: 'real' | 'mixed' | 'estimated' =
    realMonths === 0 ? 'estimated' : realMonths === totalMonths ? 'real' : 'mixed';

  const nomFixA = R.act.fijo * 12;
  const nomFixP = R.prop.fijo * 12;
  const agA = R.act.fijo * R.act.aguinaldo_meses;
  const agP = R.prop.fijo * R.prop.aguinaldo_meses;
  const varA = l12.reduce((a, r) => a + r.poolA, 0);
  const varP = l12.reduce((a, r) => a + r.poolP, 0);
  const csA = (nomFixA + agA + varA) * R.payrollTax;
  const csP = (nomFixP + agP + varP) * R.payrollTax;
  const totNomA = nomFixA + agA + varA + csA;
  const totNomP = nomFixP + agP + varP + csP;
  const utilA = totMoA - totNomA;
  const utilP = totMoA - totNomP;
  const pctNA = totRevA > 0 ? totNomA / totRevA : 0;
  const pctNP = totRevA > 0 ? totNomP / totRevA : 0;

  const rows: PLRow[] = [
    { label: 'Revenue', actual: totRevA, propuesta: totRevA, delta: 0 },
    { label: 'CMV', actual: totCmvA, propuesta: totCmvA, delta: 0 },
    { label: 'Margen bruto', actual: totMbA, propuesta: totMbA, delta: 0, isBold: true },
    { label: 'Costos fijos', actual: totCf, propuesta: totCf, delta: 0, dataSource: costSource },
    { label: 'Costos var.', actual: totCv, propuesta: totCv, delta: 0, dataSource: costSource },
    {
      label: 'Retiros socio',
      actual: totDraw,
      propuesta: totDraw,
      delta: 0,
      dataSource: costSource,
    },
    { label: 'Margen operativo', actual: totMoA, propuesta: totMoA, delta: 0, isBold: true },
    {
      label: 'Nómina fija',
      actual: nomFixA,
      propuesta: nomFixP,
      delta: nomFixP - nomFixA,
      dataSource: 'estimated',
    },
    { label: 'Aguinaldo', actual: agA, propuesta: agP, delta: agP - agA, dataSource: 'estimated' },
    {
      label: 'Variable',
      actual: varA,
      propuesta: varP,
      delta: varP - varA,
      dataSource: 'estimated',
    },
    {
      label: 'Cargas sociales',
      actual: csA,
      propuesta: csP,
      delta: csP - csA,
      dataSource: 'estimated',
    },
    {
      label: 'Total nómina',
      actual: totNomA,
      propuesta: totNomP,
      delta: totNomP - totNomA,
      isBold: true,
    },
    {
      label: 'Utilidad final',
      actual: utilA,
      propuesta: utilP,
      delta: utilP - utilA,
      isHighlight: true,
    },
    { label: '% nómina/fact.', actual: pctNA, propuesta: pctNP, delta: pctNP - pctNA, isPct: true },
  ];

  return {
    rows,
    hasProjected: l12.some((r) => r.projected),
    projectedRevenue: R.rows.find((r) => r.projected)?.rev || 0,
    hasRealCosts: hasRealData,
    realMonths,
    totalMonths,
  };
}
