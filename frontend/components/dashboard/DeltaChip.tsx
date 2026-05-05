/**
 * DeltaChip
 * Small inline indicator showing % delta vs a comparison period.
 * Green when positive, red when negative, muted when null/zero.
 */

import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeltaChipProps {
  delta: number | null;
  label?: string;
  invertColors?: boolean;
}

export function DeltaChip({ delta, label, invertColors = false }: DeltaChipProps) {
  if (delta === null || !isFinite(delta)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs opacity-60">
        <ArrowRight className="h-3 w-3" />
        s/d{label ? ` ${label}` : ''}
      </span>
    );
  }

  const isUp = delta > 0;
  const isFlat = Math.abs(delta) < 0.5;
  const positiveIsBad = invertColors;

  const colorClass = isFlat
    ? 'opacity-70'
    : (isUp && !positiveIsBad) || (!isUp && positiveIsBad)
      ? 'text-green-200'
      : 'text-red-200';

  const Icon = isFlat ? ArrowRight : isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', colorClass)}>
      <Icon className="h-3 w-3" />
      {isUp ? '+' : ''}
      {delta.toFixed(1)}%{label ? ` ${label}` : ''}
    </span>
  );
}
