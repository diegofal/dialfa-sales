'use client';

import { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { ClickableTableRow } from '@/components/ui/clickable-table-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { LoadingSpinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface ColumnDef<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortKey?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

interface DataTablePagination {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

interface DataTableSorting {
  sortBy?: string;
  sortDescending?: boolean;
  onSort: (sortBy: string, sortDescending: boolean) => void;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (row: T) => string | number;
  pagination?: DataTablePagination;
  sorting?: DataTableSorting;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: React.ReactNode;
  className?: string;
  tableClassName?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  pagination,
  sorting,
  onRowClick,
  isLoading = false,
  emptyMessage = 'No se encontraron resultados',
  emptyTitle,
  emptyIcon,
  emptyAction,
  className,
  tableClassName,
}: DataTableProps<T>) {
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyMessage}
        action={emptyAction}
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-md border">
        <Table className={tableClassName}>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <SortableTableHead
                  key={column.id}
                  sortKey={column.sortKey}
                  currentSortBy={sorting?.sortBy}
                  currentSortDescending={sorting?.sortDescending}
                  onSort={sorting?.onSort}
                  align={column.align}
                  className={column.className}
                >
                  {column.header}
                </SortableTableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const key = keyExtractor(row);
              const cells = columns.map((column) => (
                <TableCell
                  key={column.id}
                  className={cn(
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.className
                  )}
                >
                  {column.cell(row)}
                </TableCell>
              ));

              if (onRowClick) {
                return (
                  <ClickableTableRow key={key} onRowClick={() => onRowClick(row)}>
                    {cells}
                  </ClickableTableRow>
                );
              }

              return <TableRow key={key}>{cells}</TableRow>;
            })}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalCount > 0 && (
        <Pagination
          totalCount={pagination.totalCount}
          currentPage={pagination.currentPage}
          pageSize={pagination.pageSize}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </div>
  );
}
