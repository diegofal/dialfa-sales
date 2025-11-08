/**
 * Metric Card Component
 * Displays a single metric with gradient background
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  gradient: string;
  loading?: boolean;
  children?: React.ReactNode;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  loading = false,
  children,
}: MetricCardProps) {
  return (
    <Card 
      className={cn(
        'relative overflow-hidden border-0 text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl',
        gradient
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium uppercase tracking-wide opacity-90">
          {title}
        </CardTitle>
        <div className="rounded-full bg-white/20 p-2 backdrop-blur-sm">
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? (
          <div className="h-10 w-32 animate-pulse rounded bg-white/20" />
        ) : (
          <>
            <div className="text-3xl font-bold tracking-tight">{value}</div>
            {subtitle && (
              <p className="text-xs opacity-75">{subtitle}</p>
            )}
            {children}
          </>
        )}
      </CardContent>
    </Card>
  );
}


