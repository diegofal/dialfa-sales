import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LucideIcon } from "lucide-react"

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between", className)}>
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          {Icon && <Icon className="h-8 w-8 text-primary" />}
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}

interface PageHeaderActionProps {
  label: string
  icon?: LucideIcon
  onClick: () => void
  disabled?: boolean
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive"
}

export function PageHeaderAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  variant = "default",
}: PageHeaderActionProps) {
  return (
    <Button onClick={onClick} disabled={disabled} variant={variant}>
      {Icon && <Icon className="h-4 w-4 mr-2" />}
      {label}
    </Button>
  )
}
