import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils/cn"
import { LucideChevronRight, LucideHome } from "lucide-react"

export interface BreadcrumbItem {
    label: string
    href?: string
    icon?: React.ReactNode
}

interface BreadcrumbProps {
    items: BreadcrumbItem[]
    className?: string
    showHome?: boolean
}

function Breadcrumb({ items, className, showHome = true }: BreadcrumbProps) {
    return (
        <nav className={cn("flex items-center gap-1 text-sm", className)} aria-label="Breadcrumb">
            {showHome && (
                <>
                    <Link 
                        href="/dashboard"
                        className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                    >
                        <LucideHome size={14} />
                        <span className="hidden sm:inline">Inicio</span>
                    </Link>
                    <LucideChevronRight size={14} className="text-muted-foreground/50" />
                </>
            )}
            {items.map((item, index) => {
                const isLast = index === items.length - 1
                
                if (isLast) {
                    return (
                        <span 
                            key={index}
                            className="flex items-center gap-1.5 text-foreground font-medium truncate max-w-[200px]"
                        >
                            {item.icon}
                            <span className="truncate">{item.label}</span>
                        </span>
                    )
                }
                
                if (item.href) {
                    return (
                        <React.Fragment key={index}>
                            <Link
                                href={item.href}
                                className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors truncate max-w-[150px]"
                            >
                                {item.icon}
                                <span className="truncate">{item.label}</span>
                            </Link>
                            <LucideChevronRight size={14} className="text-muted-foreground/50 shrink-0" />
                        </React.Fragment>
                    )
                }
                
                return (
                    <React.Fragment key={index}>
                        <span className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[150px]">
                            {item.icon}
                            <span className="truncate">{item.label}</span>
                        </span>
                        <LucideChevronRight size={14} className="text-muted-foreground/50 shrink-0" />
                    </React.Fragment>
                )
            })}
        </nav>
    )
}

export { Breadcrumb }
