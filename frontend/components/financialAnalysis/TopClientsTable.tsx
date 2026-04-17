'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TopClient } from '@/types/financialAnalysis';

interface TopClientsTableProps {
  data: TopClient[];
  totalSales12m: number;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function TopClientsTable({ data, totalSales12m }: TopClientsTableProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Top 20 Clientes (12 meses)
        </h3>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="text-muted-foreground bg-card border-b text-xs uppercase">
                <th className="pb-2 text-left">#</th>
                <th className="pb-2 text-left">Cliente</th>
                <th className="pb-2 text-right">Facturas</th>
                <th className="pb-2 text-right">Neto USD</th>
                <th className="pb-2 text-right">% Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c, i) => (
                <tr key={c.cliente} className="border-border/30 border-b">
                  <td className="text-muted-foreground py-1.5 text-xs">{i + 1}</td>
                  <td className="py-1.5 font-medium">{c.cliente}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.facturas}</td>
                  <td className="py-1.5 text-right tabular-nums">${fmt(c.net_usd)}</td>
                  <td className="text-muted-foreground py-1.5 text-right tabular-nums">
                    {totalSales12m > 0 ? ((c.net_usd / totalSales12m) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
