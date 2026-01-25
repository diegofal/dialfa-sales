'use client';

import { ShoppingCart, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ROUTES } from '@/lib/constants/routes';
import { useQuickCartTabs } from '@/lib/hooks/domain/useQuickCartTabs';
import { cn } from '@/lib/utils';

export default function PedidosMenuItem() {
  const pathname = usePathname();
  const router = useRouter();
  const { tabs, removeTab, activeTabId, setActiveTab } = useQuickCartTabs();
  const [isExpanded] = useState(true);

  const isActive =
    pathname === ROUTES.SALES_ORDERS || pathname.startsWith(ROUTES.SALES_ORDERS + '/');
  const isNewOrderPage = pathname === ROUTES.SALES_ORDERS_NEW;
  const isOrderDetailPage = pathname.match(/^\/dashboard\/sales-orders\/\d+(\/edit)?$/);

  const handleTabClick = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    setActiveTab(tabId);

    // Navigate based on tab type
    if (tab.orderId) {
      // If it's a saved order, navigate to edit page
      router.push(`${ROUTES.SALES_ORDERS}/${tab.orderId}/edit`);
    } else {
      // If it's a draft, navigate to new order page with QuickCart
      router.push(`${ROUTES.SALES_ORDERS_NEW}?fromQuickCart=true&tabId=${tabId}`);
    }
  };

  const handleRemoveTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();

    removeTab(tabId);
    toast.success('Pedido cerrado', {
      duration: 2000,
      position: 'top-center',
    });

    // If we're currently viewing this tab, navigate away
    if (isNewOrderPage && pathname.includes(tabId)) {
      router.push(ROUTES.SALES_ORDERS);
    }
  };

  return (
    <>
      <div className="space-y-1">
        {/* Main Pedidos Menu Item */}
        <Link
          href={ROUTES.SALES_ORDERS}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive && !isNewOrderPage && !isOrderDetailPage
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <ShoppingCart className="h-5 w-5" />
          Pedidos
        </Link>

        {/* Sub-items (All tabs - drafts and saved orders for navigation) */}
        {isExpanded && (
          <div className="ml-6 space-y-1">
            {tabs.length === 0 ? (
              <div className="text-muted-foreground px-3 py-2 text-xs italic">
                No hay pedidos activos
              </div>
            ) : (
              tabs.map((tab) => {
                const isTabActive =
                  (isNewOrderPage &&
                    !tab.orderId &&
                    (pathname.includes(`tabId=${tab.id}`) ||
                      (tab.id === activeTabId && !pathname.includes('tabId=')))) ||
                  // Mark as active if we're on the edit page for this saved order
                  (tab.orderId && pathname.includes(`/sales-orders/${tab.orderId}/edit`));

                const isDraft = !tab.orderId; // Drafts are italic, saved orders are not

                return (
                  <TooltipProvider key={tab.id}>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                            isTabActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                          onClick={() => handleTabClick(tab.id)}
                        >
                          <div className={cn('min-w-0 flex-1 truncate', isDraft && 'italic')}>
                            {tab.orderNumber ? `#${tab.orderNumber} - ` : ''}
                            {tab.clientName || tab.name}
                            {tab.items.length > 0 && (
                              <span className="ml-1 text-xs opacity-70">({tab.items.length})</span>
                            )}
                          </div>
                          <button
                            onClick={(e) => handleRemoveTab(e, tab.id)}
                            className="hover:bg-destructive/10 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label={`Cerrar ${tab.clientName || tab.name}`}
                          >
                            <X className="text-muted-foreground hover:text-destructive h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start">
                        <p>
                          {tab.orderNumber ? `#${tab.orderNumber} - ` : ''}
                          {tab.clientName || tab.name}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
}
