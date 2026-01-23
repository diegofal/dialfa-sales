'use client';

import { Package, ChevronDown, ChevronRight, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';

export default function ArticulosMenuItem() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);

  const isActive = pathname === ROUTES.ARTICLES || pathname.startsWith(ROUTES.ARTICLES + '/');
  const isArticlesListActive = pathname === ROUTES.ARTICLES;
  const isValuationActive = pathname === ROUTES.ARTICLES_VALUATION;

  return (
    <div className="space-y-1">
      {/* Main Artículos Menu Item */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Package className="h-5 w-5" />
        <span className="flex-1 text-left">Artículos</span>
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {/* Sub-items */}
      {isExpanded && (
        <div className="ml-6 space-y-1">
          <Link
            href={ROUTES.ARTICLES}
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
            href={ROUTES.ARTICLES_VALUATION}
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
