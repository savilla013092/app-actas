import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils/cn"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary ring-1 ring-primary/20",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/15 text-destructive ring-1 ring-destructive/20",
        success: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
        warning: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
        info: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
        outline: "border border-input bg-background text-foreground",
        pending: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
        completed: "bg-green-100 text-green-700 ring-1 ring-green-200",
        error: "bg-red-100 text-red-700 ring-1 ring-red-200",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode
}

function Badge({ className, variant, size, icon, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
