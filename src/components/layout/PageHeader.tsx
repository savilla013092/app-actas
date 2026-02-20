'use client';

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils/cn"
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { LucideArrowLeft, LucideHome } from "lucide-react"

interface ActionButton {
    label: string
    onClick?: () => void
    href?: string
    icon?: React.ReactNode
    variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'success' | 'warning' | 'info'
    loading?: boolean
}

interface PageHeaderProps {
    title: string
    subtitle?: string
    breadcrumbItems?: BreadcrumbItem[]
    actions?: ActionButton[]
    backHref?: string
    showBackButton?: boolean
    showHomeButton?: boolean
    className?: string
    children?: React.ReactNode
}

function PageHeader({
    title,
    subtitle,
    breadcrumbItems = [],
    actions = [],
    backHref,
    showBackButton = true,
    showHomeButton = false,
    className,
    children,
}: PageHeaderProps) {
    const router = useRouter()

    const handleBack = () => {
        if (backHref) {
            router.push(backHref)
        } else {
            router.back()
        }
    }

    return (
        <div className={cn("space-y-4 mb-6", className)}>
            {/* Breadcrumb */}
            {breadcrumbItems.length > 0 && (
                <Breadcrumb items={breadcrumbItems} />
            )}

            {/* Navigation buttons row */}
            {(showBackButton || showHomeButton) && breadcrumbItems.length === 0 && (
                <div className="flex items-center gap-2">
                    {showBackButton && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBack}
                            className="gap-2"
                        >
                            <LucideArrowLeft size={16} />
                            <span className="hidden sm:inline">Volver</span>
                        </Button>
                    )}
                    {showHomeButton && (
                        <Link href="/dashboard">
                            <Button variant="outline" size="sm" className="gap-2">
                                <LucideHome size={16} />
                                <span className="hidden sm:inline">Inicio</span>
                            </Button>
                        </Link>
                    )}
                </div>
            )}

            {/* Title and Actions row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-bold text-foreground truncate">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-muted-foreground text-sm mt-1 truncate">
                            {subtitle}
                        </p>
                    )}
                </div>

                {actions.length > 0 && (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {actions.map((action, index) => {
                            if (action.href) {
                                return (
                                    <Link key={index} href={action.href}>
                                        <Button
                                            variant={action.variant || 'default'}
                                            className="gap-2"
                                            loading={action.loading}
                                        >
                                            {action.icon}
                                            {action.label}
                                        </Button>
                                    </Link>
                                )
                            }

                            return (
                                <Button
                                    key={index}
                                    variant={action.variant || 'default'}
                                    onClick={action.onClick}
                                    loading={action.loading}
                                    className="gap-2"
                                >
                                    {action.icon}
                                    {action.label}
                                </Button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Additional content */}
            {children}
        </div>
    )
}

export { PageHeader }
export type { PageHeaderProps, ActionButton }
