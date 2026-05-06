'use client';

import { Keyboard, TrendingUp } from 'lucide-react';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { OperationalMetrics } from '@/components/dashboard/OperationalMetrics';
import { RecentSalesOrders } from '@/components/dashboard/RecentSalesOrders';
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart';
import { TopArticlesSold } from '@/components/dashboard/TopArticlesSold';
import { TopCustomersPanel } from '@/components/dashboard/TopCustomersPanel';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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

      {/* Fila 1 — Pulso comercial */}
      <DashboardMetrics />

      {/* Fila 2 — Pulso operativo */}
      <OperationalMetrics />

      {/* Fila 3 — Tendencias */}
      <div className="grid gap-6 xl:grid-cols-2">
        <SalesTrendChart />
        <TopCustomersPanel />
      </div>

      {/* Fila 4 — Top artículos vendidos del mes */}
      <TopArticlesSold />

      {/* Fila 5 — Listas operativas */}
      <div className="grid gap-6 xl:grid-cols-2">
        <RecentSalesOrders limit={5} />
        <AlertsPanel />
      </div>

      {/* Atajos de teclado (collapsed) */}
      <Accordion type="single" collapsible>
        <AccordionItem value="shortcuts" className="rounded-lg border px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Keyboard className="text-primary h-4 w-4" />
              <span className="text-sm font-medium">Atajos de Teclado</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 pt-2 md:grid-cols-2">
              <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Abrir/Cerrar Carrito</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Toggle del carrito de pedidos
                  </p>
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
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
