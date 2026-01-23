'use client';

import { Keyboard, TrendingUp } from 'lucide-react';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { RecentSalesOrders } from '@/components/dashboard/RecentSalesOrders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/authStore';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <TrendingUp className="text-primary h-8 w-8" />
            Business Intelligence Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Información en tiempo real sobre el rendimiento de tu negocio
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-sm">Bienvenido,</p>
          <p className="font-semibold">{user?.fullName || user?.username || 'Usuario'}</p>
        </div>
      </div>

      {/* BI Metrics Cards */}
      <DashboardMetrics />

      {/* Recent Sales Orders */}
      <RecentSalesOrders limit={5} />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="text-primary h-5 w-5" />
            <CardTitle>Atajos de Teclado</CardTitle>
          </div>
          <CardDescription>Utiliza estos atajos para trabajar más rápido</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Abrir/Cerrar Carrito</p>
                <p className="text-muted-foreground mt-1 text-xs">Toggle del carrito de pedidos</p>
              </div>
              <kbd className="bg-background border-border rounded border px-3 py-1.5 text-sm font-semibold shadow-sm">
                SPACE
              </kbd>
            </div>

            <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Cerrar Carrito</p>
                <p className="text-muted-foreground mt-1 text-xs">Cierra el carrito de pedidos</p>
              </div>
              <kbd className="bg-background border-border rounded border px-3 py-1.5 text-sm font-semibold shadow-sm">
                ESC
              </kbd>
            </div>

            <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3 opacity-60">
              <div>
                <p className="text-sm font-medium">Buscar Artículos</p>
                <p className="text-muted-foreground mt-1 text-xs">Próximamente</p>
              </div>
              <kbd className="bg-background border-border rounded border px-3 py-1.5 text-sm font-semibold shadow-sm">
                Ctrl + K
              </kbd>
            </div>

            <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3 opacity-60">
              <div>
                <p className="text-sm font-medium">Nuevo Pedido</p>
                <p className="text-muted-foreground mt-1 text-xs">Próximamente</p>
              </div>
              <kbd className="bg-background border-border rounded border px-3 py-1.5 text-sm font-semibold shadow-sm">
                Ctrl + N
              </kbd>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
