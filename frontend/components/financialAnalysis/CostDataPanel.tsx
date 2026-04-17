'use client';

import { Card, CardContent } from '@/components/ui/card';
import { SOURCE_LABELS, type ImportSource } from '@/lib/utils/financialImport/types';

interface CostRow {
  year_month: string;
  source: string;
  category: string;
  amount_ars: number;
  amount_usd: number | null;
  exchange_rate: number | null;
}

interface CostDataPanelProps {
  costs: Record<string, CostRow[]>;
  months: string[];
}

const SOURCES: ImportSource[] = ['bank_extract', 'planilla_diaria', 'salarios'];

export function CostDataPanel({ costs, months }: CostDataPanelProps) {
  if (months.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
            Datos Importados
          </h3>
          <p className="text-muted-foreground text-xs">
            No hay datos importados. Importar los archivos Excel para ver datos reales.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Build status grid: which months have data from which sources
  const grid = months.map((month) => {
    const rows = costs[month] || [];
    const sourceStatus: Record<string, boolean> = {};
    for (const src of SOURCES) {
      sourceStatus[src] = rows.some((r) => r.source === src);
    }
    return { month, sourceStatus };
  });

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          Datos Importados ({months.length} meses)
        </h3>
        <div className="max-h-[200px] overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0">
              <tr className="text-muted-foreground bg-card border-b text-[9px] uppercase">
                <th className="px-2 py-1 text-left">Mes</th>
                {SOURCES.map((src) => (
                  <th key={src} className="px-2 py-1 text-center">
                    {SOURCE_LABELS[src]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map(({ month, sourceStatus }) => (
                <tr key={month} className="border-border/20 border-b">
                  <td className="px-2 py-0.5 font-medium">{month}</td>
                  {SOURCES.map((src) => (
                    <td key={src} className="px-2 py-0.5 text-center">
                      {sourceStatus[src] ? (
                        <span className="text-green-500">&#10003;</span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
