import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey?: string;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function SortableTableHead({
  children,
  sortKey,
  currentSortBy,
  currentSortDescending = false,
  onSort,
  className,
  align,
}: SortableTableHeadProps) {
  const isSorted = sortKey && currentSortBy === sortKey;
  const isSortable = sortKey && onSort;

  const handleClick = () => {
    if (!isSortable) return;
    
    // If not currently sorted, sort ascending
    if (!isSorted) {
      onSort(sortKey, false);
    }
    // If sorted ascending, sort descending
    else if (!currentSortDescending) {
      onSort(sortKey, true);
    }
    // If sorted descending, remove sorting
    else {
      onSort('', false);
    }
  };

  const getSortIcon = () => {
    if (!isSortable) return null;

    if (!isSorted) {
      return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
    }

    return currentSortDescending ? (
      <ArrowDown className="ml-2 h-4 w-4" />
    ) : (
      <ArrowUp className="ml-2 h-4 w-4" />
    );
  };

  return (
    <TableHead
      className={cn(
        isSortable && 'cursor-pointer select-none hover:bg-muted/50',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
      onClick={handleClick}
    >
      <div className={cn("flex items-center", align === 'right' && 'justify-end', align === 'center' && 'justify-center')}>
        {children}
        {getSortIcon()}
      </div>
    </TableHead>
  );
}


