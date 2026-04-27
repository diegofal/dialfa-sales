import { Badge } from '@/components/ui/badge';
import { StockStatus } from '@/types/stockValuation';

const STATUS_CONFIG: Record<StockStatus, { label: string; className: string }> = {
  [StockStatus.ACTIVE]: {
    label: 'Activo',
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  [StockStatus.SLOW_MOVING]: {
    label: 'Mov. Lento',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  },
  [StockStatus.DEAD_STOCK]: {
    label: 'Stock Muerto',
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
  [StockStatus.NEVER_SOLD]: {
    label: 'Nunca Vendido',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  },
};

interface StockStatusBadgeProps {
  status?: StockStatus | null;
  className?: string;
}

export function StockStatusBadge({ status, className }: StockStatusBadgeProps) {
  if (!status) return null;
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  return <Badge className={`${config.className} text-xs ${className ?? ''}`}>{config.label}</Badge>;
}
