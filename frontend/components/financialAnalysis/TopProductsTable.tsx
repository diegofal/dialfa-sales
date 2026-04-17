'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TopProduct } from '@/types/financialAnalysis';

interface TopProductsTableProps {
  data: TopProduct[];
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function TopProductsTable({ data }: TopProductsTableProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Top 20 Productos (12 meses)
        </h3>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="text-muted-foreground bg-card border-b text-xs uppercase">
                <th className="pb-2 text-left">#</th>
                <th className="pb-2 text-left">Código</th>
                <th className="pb-2 text-left">Descripción</th>
                <th className="pb-2 text-right">Unidades</th>
                <th className="pb-2 text-right">Facturado USD</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p, i) => (
                <tr key={p.code} className="border-border/30 border-b">
                  <td className="text-muted-foreground py-1.5 text-xs">{i + 1}</td>
                  <td className="py-1.5 font-mono text-xs">{p.code}</td>
                  <td className="max-w-[200px] truncate py-1.5" title={p.descripcion}>
                    {p.descripcion}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(p.unidades)}</td>
                  <td className="py-1.5 text-right tabular-nums">${fmt(p.facturado_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
