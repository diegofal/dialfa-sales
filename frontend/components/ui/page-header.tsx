import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between', className)}>
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          {Icon && <Icon className="text-primary h-8 w-8" />}
          {title}
        </h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

interface PageHeaderActionProps {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
}

export function PageHeaderAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  variant = 'default',
}: PageHeaderActionProps) {
  return (
    <Button onClick={onClick} disabled={disabled} variant={variant}>
      {Icon && <Icon className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );
}
