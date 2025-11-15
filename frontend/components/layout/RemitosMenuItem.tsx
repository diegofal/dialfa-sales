'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Truck, X, AlertCircle } from 'lucide-react';
import { useQuickDeliveryNoteTabs } from '@/lib/hooks/useQuickDeliveryNoteTabs';
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

export default function RemitosMenuItem() {
  const pathname = usePathname();
  const router = useRouter();
  const { tabs, removeTab, activeTabId, setActiveTab } = useQuickDeliveryNoteTabs();
  const [isExpanded, setIsExpanded] = useState(true);
  const [tabToRemove, setTabToRemove] = useState<string | null>(null);

  const isActive = pathname === '/dashboard/delivery-notes' || pathname.startsWith('/dashboard/delivery-notes/');
  const isDeliveryNoteDetailPage = pathname.match(/^\/dashboard\/delivery-notes\/\d+$/);

  const handleTabClick = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    setActiveTab(tabId);
    router.push(`/dashboard/delivery-notes/${tab.deliveryNoteId}`);
  };

  const handleRemoveTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    setTabToRemove(tabId);
  };

  const removeTabImmediate = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    removeTab(tabId);
    toast.success('Remito cerrado', {
      duration: 2000,
      position: 'top-center'
    });

    // If we're currently viewing this tab, navigate away
    if (tab && pathname.includes(`/delivery-notes/${tab.deliveryNoteId}`)) {
      router.push('/dashboard/delivery-notes');
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
        {/* Main Remitos Menu Item */}
        <Link
          href="/dashboard/delivery-notes"
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
              <div className="px-3 py-2 text-xs text-muted-foreground italic">
                No hay remitos abiertos
              </div>
            ) : (
              tabs.map((tab) => {
                const isTabActive = pathname.includes(`/delivery-notes/${tab.deliveryNoteId}`);
                
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
                      {tab.deliveryNumber} - {tab.clientName}
                    </div>
                    <button
                      onClick={(e) => handleRemoveTab(e, tab.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                      aria-label={`Cerrar ${tab.deliveryNumber}`}
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
              ¿Cerrar remito?
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas cerrar el remito{' '}
              <span className="font-semibold">{tabToRemoveData?.deliveryNumber}</span> de{' '}
              <span className="font-semibold">{tabToRemoveData?.clientName}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cerrar remito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}








