'use client';

import { Input } from '@/components/ui/input';
import type { PayrollProfile } from '@/types/financialAnalysis';

interface ProfileEditorProps {
  profileKey: 'actual' | 'propuesta';
  profile: PayrollProfile;
  onChange: (profile: PayrollProfile) => void;
}

function fmt(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

export function ProfileEditor({ profileKey, profile, onChange }: ProfileEditorProps) {
  const dotClass = profileKey === 'actual' ? 'text-slate-500' : 'text-blue-500';
  const fijo = profile.rows.reduce((a, r) => a + r.count * r.salary, 0);

  const updateRow = (idx: number, field: string, value: string | boolean) => {
    const rows = [...profile.rows];
    if (field === 'participates') {
      rows[idx] = { ...rows[idx], participates: value as boolean };
    } else if (field === 'salary') {
      rows[idx] = { ...rows[idx], salary: Math.max(0, parseFloat(value as string) || 0) };
    } else if (field === 'count') {
      rows[idx] = { ...rows[idx], count: Math.max(0, parseInt(value as string) || 0) };
    } else if (field === 'name') {
      rows[idx] = { ...rows[idx], name: value as string };
    }
    onChange({ ...profile, rows });
  };

  const removeRow = (idx: number) => {
    const rows = profile.rows.filter((_, i) => i !== idx);
    onChange({ ...profile, rows });
  };

  const addRow = () => {
    onChange({
      ...profile,
      rows: [...profile.rows, { name: 'Nuevo', count: 1, salary: 1000, participates: true }],
    });
  };

  return (
    <div className="mb-2">
      <h3 className="text-muted-foreground mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase">
        <span className={dotClass}>&#9679;</span> {profile.label}
      </h3>

      <table className="w-full table-fixed border-collapse text-[11px]">
        <colgroup>
          <col className="w-[100px]" />
          <col className="w-[45px]" />
          <col className="w-[70px]" />
          <col className="w-[35px]" />
          <col className="w-[30px]" />
        </colgroup>
        <thead>
          <tr className="text-muted-foreground border-b text-[9px] uppercase">
            <th className="px-1 py-0.5 text-left">Nombre</th>
            <th className="px-1 py-0.5 text-center">N</th>
            <th className="px-1 py-0.5 text-left">USD</th>
            <th className="px-1 py-0.5 text-center">Var</th>
            <th className="px-1 py-0.5"></th>
          </tr>
        </thead>
        <tbody>
          {profile.rows.map((row, i) => (
            <tr key={i}>
              <td className="py-0.5 pr-1">
                <Input
                  value={row.name}
                  onChange={(e) => updateRow(i, 'name', e.target.value)}
                  className="h-6 w-full text-[11px]"
                />
              </td>
              <td className="py-0.5 pr-1">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={row.count}
                  onChange={(e) => updateRow(i, 'count', e.target.value)}
                  className="h-6 w-full text-center text-[11px]"
                />
              </td>
              <td className="py-0.5 pr-1">
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={row.salary}
                  onChange={(e) => updateRow(i, 'salary', e.target.value)}
                  className="h-6 w-full text-[11px]"
                />
              </td>
              <td className="py-0.5 text-center">
                <input
                  type="checkbox"
                  checked={row.participates}
                  onChange={(e) => updateRow(i, 'participates', e.target.checked)}
                  className="cursor-pointer"
                />
              </td>
              <td className="py-0.5 text-center">
                <button
                  onClick={() => removeRow(i)}
                  className="text-muted-foreground hover:text-destructive border-border rounded border px-1.5 text-xs leading-none"
                >
                  x
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={addRow}
        className="text-primary mt-1 rounded border border-dashed border-blue-500 px-2 py-0.5 text-[10px] hover:bg-blue-500/10"
      >
        + Agregar
      </button>

      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-[10px]">
        <label className="flex items-center gap-1">
          Aguinaldo
          <Input
            type="number"
            min={0}
            max={3}
            step={0.5}
            value={profile.aguinaldo_meses}
            onChange={(e) =>
              onChange({
                ...profile,
                aguinaldo_meses: Math.max(0, parseFloat(e.target.value) || 0),
              })
            }
            className="h-5 w-11 text-[10px]"
          />
          m
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={profile.pays_variable}
            onChange={(e) => onChange({ ...profile, pays_variable: e.target.checked })}
            className="cursor-pointer"
          />
          Paga variable
        </label>
      </div>

      <div className="mt-1 text-xs font-semibold">
        {fmt(fijo)}/mes <span className="text-muted-foreground text-[10px] font-normal">fijo</span>
      </div>
    </div>
  );
}
