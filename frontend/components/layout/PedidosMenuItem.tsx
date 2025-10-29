'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ShoppingCart, ChevronDown, ChevronRight, X, AlertCircle } from 'lucide-react';
import { useQuickCartTabs } from '@/lib/hooks/useQuickCartTabs';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function PedidosMenuItem() {
  const pathname = usePathname();
  const router = useRouter();
  const { tabs, removeTab, activeTabId, setActiveTab } = useQuickCartTabs();
  const [isExpanded, setIsExpanded] = useState(true);
  const [tabToRemove, setTabToRemove] = useState<string | null>(null);

  const isActive = pathname === '/dashboard/sales-orders' || pathname.startsWith('/dashboard/sales-orders/');
  const isNewOrderPage = pathname === '/dashboard/sales-orders/new';

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/dashboard/sales-orders/new?fromQuickCart=true&tabId=${tabId}`);
  };

  const handleRemoveTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    
    const tab = tabs.find(t => t.id === tabId);
    
    // If tab has items, show confirmation dialog
    if (tab && tab.items.length > 0) {
      setTabToRemove(tabId);
    } else {
      // If empty, remove immediately
      removeTabImmediate(tabId);
    }
  };

  const removeTabImmediate = (tabId: string) => {
    removeTab(tabId);
    toast.success('Pedido eliminado', {
      duration: 2000,
      position: 'top-center'
    });

    // If we're currently viewing this tab, navigate away
    if (isNewOrderPage && pathname.includes(tabId)) {
      router.push('/dashboard/sales-orders');
    }
  };

  const handleConfirmRemove = () => {
    if (tabToRemove) {
      removeTabImmediate(tabToRemove);
      setTabToRemove(null);
    }
  };

  const tabToRemoveData = tabs.find(t => t.id === tabToRemove);

  return (
    <>
      <div className="space-y-1">
        {/* Main Pedidos Menu Item */}
        <Link
          href="/dashboard/sales-orders"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive && !isNewOrderPage
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <ShoppingCart className="h-5 w-5" />
          Pedidos
        </Link>

        {/* Sub-items (Quick Cart Tabs) */}
        {isExpanded && (
          <div className="ml-6 space-y-1">
            {tabs.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic">
                No hay pedidos activos
              </div>
            ) : (
              tabs.map((tab) => {
                const isTabActive = isNewOrderPage && (
                  pathname.includes(`tabId=${tab.id}`) || 
                  (tab.id === activeTabId && !pathname.includes('tabId='))
                );
                
                return (
                  <div
                    key={tab.id}
                    className={cn(
                      'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer',
                      isTabActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                    onClick={() => handleTabClick(tab.id)}
                  >
                    <div className="flex-1 min-w-0 truncate">
                      {tab.clientName || tab.name}
                      {tab.items.length > 0 && (
                        <span className="ml-1 text-xs opacity-70">
                          ({tab.items.length})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleRemoveTab(e, tab.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                      aria-label={`Cerrar ${tab.clientName || tab.name}`}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!tabToRemove} onOpenChange={(open) => !open && setTabToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              ¿Cerrar pedido?
            </AlertDialogTitle>
            <AlertDialogDescription>
              El pedido <span className="font-semibold">{tabToRemoveData?.clientName || tabToRemoveData?.name}</span> tiene{' '}
              <span className="font-semibold">{tabToRemoveData?.items.length || 0} artículo(s)</span>.
              <br /><br />
              ¿Estás seguro de que deseas cerrar este pedido? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cerrar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

