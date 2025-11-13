'use client';

import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Keyboard, TrendingUp } from 'lucide-react';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { RecentSalesOrders } from '@/components/dashboard/RecentSalesOrders';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            Business Intelligence Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Información en tiempo real sobre el rendimiento de tu negocio
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Bienvenido,</p>
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
            <Keyboard className="h-5 w-5 text-primary" />
            <CardTitle>Atajos de Teclado</CardTitle>
          </div>
          <CardDescription>
            Utiliza estos atajos para trabajar más rápido
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Abrir/Cerrar Carrito</p>
                <p className="text-xs text-muted-foreground mt-1">Toggle del carrito de pedidos</p>
              </div>
              <kbd className="px-3 py-1.5 text-sm font-semibold bg-background border border-border rounded shadow-sm">
                SPACE
              </kbd>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Cerrar Carrito</p>
                <p className="text-xs text-muted-foreground mt-1">Cierra el carrito de pedidos</p>
              </div>
              <kbd className="px-3 py-1.5 text-sm font-semibold bg-background border border-border rounded shadow-sm">
                ESC
              </kbd>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 opacity-60">
              <div>
                <p className="text-sm font-medium">Buscar Artículos</p>
                <p className="text-xs text-muted-foreground mt-1">Próximamente</p>
              </div>
              <kbd className="px-3 py-1.5 text-sm font-semibold bg-background border border-border rounded shadow-sm">
                Ctrl + K
              </kbd>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 opacity-60">
              <div>
                <p className="text-sm font-medium">Nuevo Pedido</p>
                <p className="text-xs text-muted-foreground mt-1">Próximamente</p>
              </div>
              <kbd className="px-3 py-1.5 text-sm font-semibold bg-background border border-border rounded shadow-sm">
                Ctrl + N
              </kbd>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


