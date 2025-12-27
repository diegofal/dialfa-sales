'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Package, ChevronDown, ChevronRight, DollarSign } from 'lucide-react';

export default function ArticulosMenuItem() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);

  const isActive = pathname === '/dashboard/articles' || pathname.startsWith('/dashboard/articles/');
  const isArticlesListActive = pathname === '/dashboard/articles';
  const isValuationActive = pathname === '/dashboard/articles/valuation';

  return (
    <div className="space-y-1">
      {/* Main Artículos Menu Item */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Package className="h-5 w-5" />
        <span className="flex-1 text-left">Artículos</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {/* Sub-items */}
      {isExpanded && (
        <div className="ml-6 space-y-1">
          <Link
            href="/dashboard/articles"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isArticlesListActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Package className="h-4 w-4" />
            Lista de Artículos
          </Link>
          
          <Link
            href="/dashboard/articles/valuation"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isValuationActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <DollarSign className="h-4 w-4" />
            Valorización de Stock
          </Link>
        </div>
      )}
    </div>
  );
}

