'use client';

import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TransitionMatrixCell } from '@/types/stockTransitions';
import { StockStatus } from '@/types/stockValuation';

const STATUS_LABELS: Record<StockStatus, string> = {
  [StockStatus.ACTIVE]: 'Activo',
  [StockStatus.SLOW_MOVING]: 'Mov. Lento',
  [StockStatus.DEAD_STOCK]: 'Stock Muerto',
  [StockStatus.NEVER_SOLD]: 'Nunca Vendido',
};

const STATUS_ORDER: StockStatus[] = [
  StockStatus.ACTIVE,
  StockStatus.SLOW_MOVING,
  StockStatus.DEAD_STOCK,
  StockStatus.NEVER_SOLD,
];

const STATUS_RANK: Record<StockStatus, number> = {
  [StockStatus.DEAD_STOCK]: 0,
  [StockStatus.SLOW_MOVING]: 1,
  [StockStatus.ACTIVE]: 2,
  [StockStatus.NEVER_SOLD]: -1,
};

function classifyDirection(
  from: StockStatus,
  to: StockStatus
): 'upgrade' | 'downgrade' | 'sideways' {
  const fromRank = STATUS_RANK[from];
  const toRank = STATUS_RANK[to];
  if (fromRank < 0 || toRank < 0) return 'sideways';
  if (toRank > fromRank) return 'upgrade';
  if (toRank < fromRank) return 'downgrade';
  return 'sideways';
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface TransitionMatrixProps {
  matrix: TransitionMatrixCell[];
  selectedFromStatus?: StockStatus;
  selectedToStatus?: StockStatus;
  onCellClick?: (fromStatus: StockStatus, toStatus: StockStatus) => void;
}

export function TransitionMatrix({
  matrix,
  selectedFromStatus,
  selectedToStatus,
  onCellClick,
}: TransitionMatrixProps) {
  const lookup = new Map<string, TransitionMatrixCell>();
  for (const cell of matrix) {
    lookup.set(`${cell.fromStatus}|${cell.toStatus}`, cell);
  }

  const isSelected = (from: StockStatus, to: StockStatus) =>
    selectedFromStatus === from && selectedToStatus === to;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-muted-foreground p-3 text-left text-xs font-medium tracking-wider uppercase">
              De ↓ / A →
            </th>
            {STATUS_ORDER.map((status) => (
              <th
                key={status}
                className="text-muted-foreground p-3 text-center text-xs font-medium tracking-wider uppercase"
              >
                {STATUS_LABELS[status]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STATUS_ORDER.map((fromStatus) => (
            <tr key={fromStatus} className="border-t">
              <td className="bg-muted/30 text-muted-foreground p-3 text-xs font-medium tracking-wider uppercase">
                {STATUS_LABELS[fromStatus]}
              </td>
              {STATUS_ORDER.map((toStatus) => {
                if (fromStatus === toStatus) {
                  return (
                    <td key={toStatus} className="text-muted-foreground/40 p-3 text-center">
                      —
                    </td>
                  );
                }
                const cell = lookup.get(`${fromStatus}|${toStatus}`);
                const direction = classifyDirection(fromStatus, toStatus);
                const count = cell?.count ?? 0;
                const value = cell?.totalStockValue ?? 0;
                const selected = isSelected(fromStatus, toStatus);
                const hasData = count > 0;

                return (
                  <td key={toStatus} className="p-1">
                    <button
                      type="button"
                      disabled={!hasData}
                      onClick={() => hasData && onCellClick?.(fromStatus, toStatus)}
                      className={cn(
                        'group flex w-full flex-col items-center gap-1 rounded-md border p-3 text-center transition-colors',
                        hasData ? 'hover:bg-accent cursor-pointer' : 'cursor-default opacity-40',
                        selected && 'border-primary bg-accent ring-primary ring-1',
                        direction === 'upgrade' &&
                          hasData &&
                          'border-green-200 dark:border-green-900',
                        direction === 'downgrade' && hasData && 'border-red-200 dark:border-red-900'
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {direction === 'upgrade' && (
                          <ArrowUpRight className="h-3 w-3 text-green-600 dark:text-green-400" />
                        )}
                        {direction === 'downgrade' && (
                          <ArrowDownRight className="h-3 w-3 text-red-600 dark:text-red-400" />
                        )}
                        {direction === 'sideways' && (
                          <ArrowRight className="text-muted-foreground h-3 w-3" />
                        )}
                        <span className="text-lg font-semibold">{count}</span>
                      </div>
                      {hasData && (
                        <span className="text-muted-foreground text-xs">
                          {currencyFormatter.format(value)}
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
