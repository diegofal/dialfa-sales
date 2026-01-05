'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { FileText, X } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useQuickInvoiceTabs } from '@/lib/hooks/useQuickInvoiceTabs';
import { toast } from 'sonner';

export default function FacturasMenuItem() {
  const pathname = usePathname();
  const router = useRouter();
  const { tabs, removeTab, activeTabId, setActiveTab } = useQuickInvoiceTabs();
  const [isExpanded, setIsExpanded] = useState(true);

  const isActive = pathname === '/dashboard/invoices' || pathname.startsWith('/dashboard/invoices/');
  const isInvoiceDetailPage = pathname.match(/^\/dashboard\/invoices\/\d+$/);

  const handleTabClick = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    setActiveTab(tabId);
    router.push(`/dashboard/invoices/${tab.invoiceId}`);
  };

  const handleRemoveTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    
    const tab = tabs.find(t => t.id === tabId);
    removeTab(tabId);
    toast.success('Factura cerrada', {
      duration: 2000,
      position: 'top-center'
    });

    // If we're currently viewing this tab, navigate away
    if (tab && pathname.includes(`/invoices/${tab.invoiceId}`)) {
      router.push('/dashboard/invoices');
    }
  };

  return (
    <>
      <div className="space-y-1">
        {/* Main Facturas Menu Item */}
        <Link
          href="/dashboard/invoices"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive && !isInvoiceDetailPage
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <FileText className="h-5 w-5" />
          Facturas
        </Link>

        {/* Sub-items (Quick Invoice Tabs) */}
        {isExpanded && (
          <div className="ml-6 space-y-1">
            {tabs.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic">
                No hay facturas abiertas
              </div>
            ) : (
              tabs.map((tab) => {
                const isTabActive = pathname.includes(`/invoices/${tab.invoiceId}`);
                const fullText = `${tab.invoiceNumber} - ${tab.clientName}`;
                
                return (
                  <TooltipProvider key={tab.id}>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer',
                            isTabActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                          onClick={() => handleTabClick(tab.id)}
                        >
                          <div className="flex-1 min-w-0 truncate">
                            {fullText}
                          </div>
                          <button
                            onClick={(e) => handleRemoveTab(e, tab.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                            aria-label={`Cerrar ${tab.invoiceNumber}`}
                          >
                            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
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

