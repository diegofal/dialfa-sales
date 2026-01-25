'use client';

import { Truck, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ROUTES } from '@/lib/constants/routes';
import { useQuickDeliveryNoteTabs } from '@/lib/hooks/domain/useQuickDeliveryNoteTabs';
import { cn } from '@/lib/utils';

export default function RemitosMenuItem() {
  const pathname = usePathname();
  const router = useRouter();
  const { tabs, removeTab, setActiveTab } = useQuickDeliveryNoteTabs();
  const [isExpanded] = useState(true);

  const isActive =
    pathname === ROUTES.DELIVERY_NOTES || pathname.startsWith(ROUTES.DELIVERY_NOTES + '/');
  const isDeliveryNoteDetailPage = pathname.match(/^\/dashboard\/delivery-notes\/\d+$/);

  const handleTabClick = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    setActiveTab(tabId);
    router.push(`${ROUTES.DELIVERY_NOTES}/${tab.deliveryNoteId}`);
  };

  const handleRemoveTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();

    const tab = tabs.find((t) => t.id === tabId);
    removeTab(tabId);
    toast.success('Remito cerrado', {
      duration: 2000,
      position: 'top-center',
    });

    // If we're currently viewing this tab, navigate away
    if (tab && pathname.includes(`/delivery-notes/${tab.deliveryNoteId}`)) {
      router.push(ROUTES.DELIVERY_NOTES);
    }
  };

  return (
    <>
      <div className="space-y-1">
        {/* Main Remitos Menu Item */}
        <Link
          href={ROUTES.DELIVERY_NOTES}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive && !isDeliveryNoteDetailPage
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <Truck className="h-5 w-5" />
          Remitos
        </Link>

        {/* Sub-items (Quick Delivery Note Tabs) */}
        {isExpanded && (
          <div className="ml-6 space-y-1">
            {tabs.length === 0 ? (
              <div className="text-muted-foreground px-3 py-2 text-xs italic">
                No hay remitos abiertos
              </div>
            ) : (
              tabs.map((tab) => {
                const isTabActive = pathname.includes(`/delivery-notes/${tab.deliveryNoteId}`);
                const fullText = `${tab.deliveryNumber} - ${tab.clientName}`;

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
                          <div className="min-w-0 flex-1 truncate">{fullText}</div>
                          <button
                            onClick={(e) => handleRemoveTab(e, tab.id)}
                            className="hover:bg-destructive/10 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label={`Cerrar ${tab.deliveryNumber}`}
                          >
                            <X className="text-muted-foreground hover:text-destructive h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start">
                        <p>{fullText}</p>
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
