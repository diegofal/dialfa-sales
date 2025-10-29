'use client';

import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Package, ShoppingCart, FileText, Keyboard } from 'lucide-react';

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  const stats = [
    {
      title: 'Clientes',
      value: '397',
      description: 'Total de clientes activos',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Artículos',
      value: '1,797',
      description: 'Productos en inventario',
      icon: Package,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Pedidos',
      value: '39,065',
      description: 'Órdenes procesadas',
      icon: ShoppingCart,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Facturas',
      value: '32,575',
      description: 'Facturas emitidas',
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">¡Bienvenido, {user?.fullName || user?.username || 'Usuario'}!</h1>
        <p className="text-muted-foreground mt-2">
          Sistema de Gestión de Inventario y Ventas
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-full p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Acceso Rápido</CardTitle>
          <CardDescription>
            Funcionalidades disponibles en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">✅ <strong>Clientes:</strong> Gestión completa de clientes con CRUD</p>
            <p className="text-sm text-muted-foreground">⏳ Artículos: Próximamente</p>
            <p className="text-sm text-muted-foreground">⏳ Pedidos: Próximamente</p>
            <p className="text-sm text-muted-foreground">⏳ Facturas: Próximamente</p>
          </div>
        </CardContent>
      </Card>

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


