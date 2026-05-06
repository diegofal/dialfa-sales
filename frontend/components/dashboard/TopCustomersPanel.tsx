/**
 * Top Customers Panel
 * Two views: by current-month revenue (SPISA) and by AR balance (xERP).
 */

'use client';

import { Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, useDashboardCharts } from '@/lib/hooks/domain/useDashboard';

export function TopCustomersPanel() {
  const { data, isLoading, isError } = useDashboardCharts(12);

  const byRevenue = data?.topCustomersByRevenue ?? [];
  const byBalance = data?.topCustomers ?? [];
  const dataError = data?.error ?? null;

  const errorMessage = (message: string) => (
    <div className="flex flex-col items-center gap-1 py-8 text-center text-sm">
      <span className="font-medium text-amber-500">No se pudo cargar</span>
      <span className="text-muted-foreground text-xs">{message}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Top 10 Clientes
            </CardTitle>
            <CardDescription>Por facturación o saldo a cobrar</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="revenue">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="revenue">Por facturación (mes)</TabsTrigger>
            <TabsTrigger value="balance">Por saldo a cobrar</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="mt-3">
            {isLoading ? (
              <div className="bg-muted/40 h-[280px] w-full animate-pulse rounded-md" />
            ) : isError ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Error al cargar</p>
            ) : dataError ? (
              errorMessage(dataError)
            ) : byRevenue.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Aún no hay facturas SPISA en el mes
              </p>
            ) : (
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-card text-muted-foreground sticky top-0 text-xs uppercase">
                    <tr className="border-b">
                      <th className="pb-2 text-left">#</th>
                      <th className="pb-2 text-left">Cliente</th>
                      <th className="pb-2 text-right">Facturas</th>
                      <th className="pb-2 text-right">Facturado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byRevenue.map((c, i) => (
                      <tr key={c.clientId} className="border-border/30 border-b">
                        <td className="text-muted-foreground py-1.5 text-xs">{i + 1}</td>
                        <td className="truncate py-1.5 font-medium">{c.businessName}</td>
                        <td className="py-1.5 text-right tabular-nums">{c.invoiceCount}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatCurrency(c.revenueArs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="balance" className="mt-3">
            {isLoading ? (
              <div className="bg-muted/40 h-[280px] w-full animate-pulse rounded-md" />
            ) : isError ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Error al cargar</p>
            ) : dataError ? (
              errorMessage(dataError)
            ) : byBalance.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Sin clientes con saldo
              </p>
            ) : (
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-card text-muted-foreground sticky top-0 text-xs uppercase">
                    <tr className="border-b">
                      <th className="pb-2 text-left">#</th>
                      <th className="pb-2 text-left">Cliente</th>
                      <th className="pb-2 text-right">Mora %</th>
                      <th className="pb-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byBalance.map((c, i) => {
                      const overdueClass =
                        c.OverduePercentage > 50
                          ? 'text-red-500'
                          : c.OverduePercentage > 25
                            ? 'text-amber-500'
                            : 'text-muted-foreground';
                      return (
                        <tr key={`${c.Name}-${i}`} className="border-border/30 border-b">
                          <td className="text-muted-foreground py-1.5 text-xs">{i + 1}</td>
                          <td className="truncate py-1.5 font-medium">{c.Name}</td>
                          <td className={`py-1.5 text-right tabular-nums ${overdueClass}`}>
                            {(c.OverduePercentage || 0).toFixed(0)}%
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {formatCurrency(c.OutstandingBalance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
