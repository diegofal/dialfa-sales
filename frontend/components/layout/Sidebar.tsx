'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  FolderTree,
  Package, 
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
import PedidosMenuItem from './PedidosMenuItem';
import FacturasMenuItem from './FacturasMenuItem';
import RemitosMenuItem from './RemitosMenuItem';
import ArticulosMenuItem from './ArticulosMenuItem';
import { useAuthStore } from '@/store/authStore';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clientes', href: '/dashboard/clients', icon: Users },
  { name: 'Categorías', href: '/dashboard/categories', icon: FolderTree },
];

const navigationAfterRemitos = [
  { name: 'Certificados', href: '/dashboard/certificates', icon: FileCheck },
  { name: 'Feedback', href: '/dashboard/feedback', icon: MessageSquare },
  { name: 'Configuración', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-2xl font-bold text-primary">SPISA</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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
          <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Compras
          </p>
          <Link
            href="/dashboard/suppliers"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith('/dashboard/suppliers')
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Truck className="h-5 w-5" />
            Proveedores
          </Link>
          <Link
            href="/dashboard/supplier-orders"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith('/dashboard/supplier-orders')
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
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}

        {isAdmin && (
          <div className="mt-6 pt-4 border-t border-muted">
            <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Administración
            </p>
            <Link
              href="/dashboard/price-lists"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/dashboard/price-lists')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <DollarSign className="h-5 w-5" />
              Listas de Precios
            </Link>
            <Link
              href="/dashboard/payment-terms"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/dashboard/payment-terms')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <CalendarClock className="h-5 w-5" />
              Condiciones de Pago
            </Link>
            <Link
              href="/dashboard/users"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/dashboard/users')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <UserCog className="h-5 w-5" />
              Usuarios
            </Link>
            <Link
              href="/dashboard/activity"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/dashboard/activity')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <History className="h-5 w-5" />
              Actividad
            </Link>
            <Link
              href="/dashboard/feedback/admin"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/dashboard/feedback/admin')
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


