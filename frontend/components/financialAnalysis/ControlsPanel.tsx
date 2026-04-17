'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type {
  Profiles,
  CompanyCosts,
  SimulatorConfig,
  CostAnchors,
} from '@/types/financialAnalysis';
import { ProfileEditor } from './ProfileEditor';

interface ControlsPanelProps {
  profiles: Profiles;
  costs: CompanyCosts;
  config: SimulatorConfig;
  costAnchors: CostAnchors;
  onProfilesChange: (profiles: Profiles) => void;
  onCostsChange: (costs: CompanyCosts) => void;
  onConfigChange: (config: SimulatorConfig) => void;
  onResetAll: () => void;
  realMonthsCount?: number;
}

export function ControlsPanel({
  profiles,
  costs,
  config,
  costAnchors,
  onProfilesChange,
  onCostsChange,
  onConfigChange,
  onResetAll,
  realMonthsCount = 0,
}: ControlsPanelProps) {
  const updateConfig = <K extends keyof SimulatorConfig>(key: K, value: SimulatorConfig[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  const updateCosts = <K extends keyof CompanyCosts>(key: K, value: CompanyCosts[K]) => {
    onCostsChange({ ...costs, [key]: value });
  };

  const anchors = [
    { label: `FOB ${costAnchors.cmv_fob_pct}%`, value: costAnchors.cmv_fob_pct },
    { label: `CIF ${costAnchors.cmv_cif_pct}%`, value: costAnchors.cmv_cif_pct },
    { label: `Landed ${costAnchors.cmv_landed_pct}%`, value: costAnchors.cmv_landed_pct },
    { label: 'Conservador 40%', value: 40 },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Configuración
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Left: Profiles */}
          <div>
            <ProfileEditor
              profileKey="actual"
              profile={profiles.actual}
              onChange={(p) => onProfilesChange({ ...profiles, actual: p })}
            />
            <ProfileEditor
              profileKey="propuesta"
              profile={profiles.propuesta}
              onChange={(p) => onProfilesChange({ ...profiles, propuesta: p })}
            />
          </div>

          {/* Right: Config sliders & inputs */}
          <div className="space-y-2">
            {/* CMV */}
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground min-w-[130px] shrink-0 text-[11px]">
                CMV (% s/fact.)
              </label>
              <input
                type="range"
                min={10}
                max={60}
                step={0.5}
                value={config.cmv_pct}
                onChange={(e) => updateConfig('cmv_pct', parseFloat(e.target.value))}
                className="min-w-[80px] flex-1"
              />
              <span className="min-w-[50px] text-right text-xs font-semibold tabular-nums">
                {config.cmv_pct.toFixed(1)}%
              </span>
            </div>

            {/* Anchor buttons */}
            <div className="flex flex-wrap gap-1">
              {anchors.map((a) => (
                <button
                  key={a.label}
                  onClick={() => updateConfig('cmv_pct', a.value)}
                  className="rounded border border-blue-500 bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-500 hover:bg-blue-500/25"
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div className="border-border my-1 border-t" />

            {/* Costs */}
            {realMonthsCount > 0 && (
              <div className="rounded border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-500">
                Estos valores se usan solo para meses <strong>sin datos reales importados</strong>.
                Hay {realMonthsCount} mes{realMonthsCount === 1 ? '' : 'es'} usando datos reales
                (los Excel importados tienen prioridad).
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground min-w-[130px] shrink-0 text-[11px]">
                Costos fijos (USD)
              </label>
              <Input
                type="number"
                min={0}
                step={100}
                value={costs.fixed_usd_month}
                onChange={(e) =>
                  updateCosts('fixed_usd_month', Math.max(0, parseFloat(e.target.value) || 0))
                }
                className="h-7 w-20 text-[11px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground min-w-[130px] shrink-0 text-[11px]">
                Variables (%)
              </label>
              <Input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={costs.variable_pct_sales}
                onChange={(e) =>
                  updateCosts('variable_pct_sales', Math.max(0, parseFloat(e.target.value) || 0))
                }
                className="h-7 w-20 text-[11px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground min-w-[130px] shrink-0 text-[11px]">
                Retiros socio (USD)
              </label>
              <Input
                type="number"
                min={0}
                step={100}
                value={costs.owner_draw_usd}
                onChange={(e) =>
                  updateCosts('owner_draw_usd', Math.max(0, parseFloat(e.target.value) || 0))
                }
                className="h-7 w-20 text-[11px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground min-w-[130px] shrink-0 text-[11px]">
                Cargas sociales (%)
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={costs.payroll_tax_pct}
                onChange={(e) =>
                  updateCosts('payroll_tax_pct', Math.max(0, parseFloat(e.target.value) || 0))
                }
                className="h-7 w-20 text-[11px]"
              />
            </div>

            <div className="border-border my-1 border-t" />

            {/* Variable config */}
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground min-w-[130px] shrink-0 text-[11px]">
                % variable
              </label>
              <input
                type="range"
                min={1}
                max={30}
                step={0.25}
                value={config.variable_pct}
                onChange={(e) => updateConfig('variable_pct', parseFloat(e.target.value))}
                className="min-w-[80px] flex-1"
              />
              <span className="min-w-[50px] text-right text-xs font-semibold tabular-nums">
                {config.variable_pct.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground min-w-[130px] shrink-0 text-[11px]">
                Cap por persona (%)
              </label>
              <input
                type="range"
                min={0}
                max={200}
                step={5}
                value={config.cap_pct_salary}
                onChange={(e) => updateConfig('cap_pct_salary', parseFloat(e.target.value))}
                className="min-w-[80px] flex-1"
              />
              <span className="min-w-[50px] text-right text-xs font-semibold tabular-nums">
                {config.cap_pct_salary}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground min-w-[130px] shrink-0 text-[11px]">
                Frecuencia
              </label>
              <select
                value={config.frequency}
                onChange={(e) =>
                  updateConfig('frequency', e.target.value as SimulatorConfig['frequency'])
                }
                className="border-input bg-background h-7 flex-1 rounded border px-2 text-[11px]"
              >
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground min-w-[130px] shrink-0 text-[11px]">
                Fuente
              </label>
              <select
                value={config.source}
                onChange={(e) =>
                  updateConfig('source', e.target.value as SimulatorConfig['source'])
                }
                className="border-input bg-background h-7 flex-1 rounded border px-2 text-[11px]"
              >
                <option value="facturacion">Facturación</option>
                <option value="cobranza">Cobranza</option>
              </select>
            </div>

            <div className="border-border my-1 border-t" />

            {/* Revenue projection */}
            <div className="rounded-md border border-dashed border-green-500 bg-green-500/5 p-2">
              <div className="flex items-center gap-2">
                <label className="min-w-[130px] shrink-0 text-[11px] text-green-500">
                  Revenue proyectado (USD/mes)
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={config.revenue_projected}
                  placeholder="0 = usar datos reales"
                  onChange={(e) =>
                    updateConfig('revenue_projected', Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  className="h-7 w-20 text-[11px]"
                />
                <span className="text-muted-foreground min-w-[90px] text-[10px]">
                  {config.revenue_projected > 0
                    ? '$' + Math.round(config.revenue_projected).toLocaleString() + '/mes'
                    : '0 = solo real'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-muted-foreground min-w-[130px] shrink-0 text-[11px]">
                Ventana target
              </label>
              <input
                type="range"
                min={3}
                max={18}
                step={1}
                value={config.target_window}
                onChange={(e) => updateConfig('target_window', parseInt(e.target.value))}
                className="min-w-[80px] flex-1"
              />
              <span className="min-w-[50px] text-right text-xs font-semibold tabular-nums">
                {config.target_window}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground min-w-[130px] shrink-0 text-[11px]">
                Tope nómina (%)
              </label>
              <input
                type="range"
                min={20}
                max={60}
                step={0.5}
                value={config.payroll_cap_pct}
                onChange={(e) => updateConfig('payroll_cap_pct', parseFloat(e.target.value))}
                className="min-w-[80px] flex-1"
              />
              <span className="min-w-[50px] text-right text-xs font-semibold tabular-nums">
                {config.payroll_cap_pct.toFixed(0)}%
              </span>
            </div>

            <div className="mt-2">
              <button
                onClick={onResetAll}
                className="text-muted-foreground border-border hover:text-foreground hover:border-foreground rounded border px-2 py-1 text-[10px]"
              >
                Reset todo
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
