'use client';

import { FileBarChart2, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/lib/constants/routes';

interface ReportLink {
  href: string;
  title: string;
  description: string;
  icon: typeof TrendingDown;
}

const REPORTS: ReportLink[] = [
  {
    href: ROUTES.REPORTS_DEAD_STOCK_MOVEMENTS,
    title: 'Movimientos en Dead Stock',
    description:
      'Artículos que estaban en stock muerto al inicio del período y tuvieron ventas en el rango.',
    icon: TrendingDown,
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileBarChart2 className="text-primary h-7 w-7" />
          Reportes
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Reportes consolidados sobre stock, ventas y operación.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.href} href={r.href} className="block">
              <Card className="hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4" />
                    {r.title}
                  </CardTitle>
                  <CardDescription>{r.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-primary text-xs hover:underline">Abrir →</CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
