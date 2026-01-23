'use client';

import {
  LayoutDashboard,
  Users,
  FolderTree,
  Truck,
  Settings,
  FileCheck,
  UserCog,
  History,
  MessageSquare,
  MessagesSquare,
  ShoppingCart,
  DollarSign,
  CalendarClock,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import ArticulosMenuItem from './ArticulosMenuItem';
import FacturasMenuItem from './FacturasMenuItem';
import PedidosMenuItem from './PedidosMenuItem';
import RemitosMenuItem from './RemitosMenuItem';

const navigation = [
  { name: 'Dashboard', href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { name: 'Clientes', href: ROUTES.CLIENTS, icon: Users },
  { name: 'Categorías', href: ROUTES.CATEGORIES, icon: FolderTree },
];

const navigationAfterRemitos = [
  { name: 'Certificados', href: ROUTES.CERTIFICATES, icon: FileCheck },
  { name: 'Feedback', href: ROUTES.FEEDBACK, icon: MessageSquare },
  { name: 'Configuración', href: ROUTES.SETTINGS, icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full w-64 flex-col">
      <div className="border-sidebar-border flex h-16 flex-shrink-0 items-center border-b px-6">
        <h1 className="text-sidebar-primary text-2xl font-bold">SPISA</h1>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}

        {/* Artículos with expandable sub-items */}
        <ArticulosMenuItem />

        {/* Pedidos with expandable sub-items */}
        <PedidosMenuItem />

        {/* Facturas with expandable sub-items */}
        <FacturasMenuItem />

        {/* Remitos with expandable sub-items */}
        <RemitosMenuItem />

        {/* Proveedores section */}
        <div className="mt-4 mb-2">
          <p className="text-muted-foreground mb-2 px-3 text-xs font-semibold tracking-wider uppercase">
            Compras
          </p>
          <Link
            href={ROUTES.SUPPLIERS}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(ROUTES.SUPPLIERS)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Truck className="h-5 w-5" />
            Proveedores
          </Link>
          <Link
            href={ROUTES.SUPPLIER_ORDERS}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(ROUTES.SUPPLIER_ORDERS)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <ShoppingCart className="h-5 w-5" />
            Pedidos a Proveedores
          </Link>
        </div>

        {navigationAfterRemitos.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}

        {isAdmin && (
          <div className="border-sidebar-border mt-6 border-t pt-4">
            <p className="text-muted-foreground mb-2 px-3 text-xs font-semibold tracking-wider uppercase">
              Administración
            </p>
            <Link
              href={ROUTES.PRICE_LISTS}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith(ROUTES.PRICE_LISTS)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <DollarSign className="h-5 w-5" />
              Listas de Precios
            </Link>
            <Link
              href={ROUTES.PAYMENT_TERMS}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith(ROUTES.PAYMENT_TERMS)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <CalendarClock className="h-5 w-5" />
              Condiciones de Pago
            </Link>
            <Link
              href={ROUTES.USERS}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith(ROUTES.USERS)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <UserCog className="h-5 w-5" />
              Usuarios
            </Link>
            <Link
              href={ROUTES.ACTIVITY}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith(ROUTES.ACTIVITY)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <History className="h-5 w-5" />
              Actividad
            </Link>
            <Link
              href={ROUTES.FEEDBACK_ADMIN}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith(ROUTES.FEEDBACK_ADMIN)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <MessagesSquare className="h-5 w-5" />
              Gestión Feedback
            </Link>
          </div>
        )}
      </nav>
    </div>
  );
}
