'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LucideArrowLeft, LucideHome } from 'lucide-react';

import { Breadcrumb, BreadcrumbItem } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface ActionButton {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ReactNode;
    variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'success' | 'warning' | 'info';
    loading?: boolean;
}

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    breadcrumbItems?: BreadcrumbItem[];
    actions?: ActionButton[];
    backHref?: string;
    showBackButton?: boolean;
    showHomeButton?: boolean;
    className?: string;
    children?: React.ReactNode;
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
    const router = useRouter();

    const handleBack = () => {
        if (backHref) {
            router.push(backHref);
        } else {
            router.back();
        }
    };

    return (
        <div className={cn('mb-6 space-y-4', className)}>
            {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} />}

            {(showBackButton || showHomeButton) && breadcrumbItems.length === 0 && (
                <div className='flex items-center gap-2'>
                    {showBackButton && (
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={handleBack}
                            className='gap-2'
                        >
                            <LucideArrowLeft size={16} />
                            <span className='hidden sm:inline'>Volver</span>
                        </Button>
                    )}
                    {showHomeButton && (
                        <Button asChild variant='outline' size='sm' className='gap-2'>
                            <Link href='/dashboard'>
                                <LucideHome size={16} />
                                <span className='hidden sm:inline'>Inicio</span>
                            </Link>
                        </Button>
                    )}
                </div>
            )}

            <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-center'>
                <div className='min-w-0 flex-1'>
                    <h1 className='truncate text-2xl font-bold text-foreground'>
                        {title}
                    </h1>
                    {subtitle && (
                        <p className='mt-1 truncate text-sm text-muted-foreground'>
                            {subtitle}
                        </p>
                    )}
                </div>

                {actions.length > 0 && (
                    <div className='flex shrink-0 flex-wrap items-center gap-2'>
                        {actions.map((action, index) => {
                            if (action.href) {
                                return (
                                    <Button
                                        key={index}
                                        asChild
                                        variant={action.variant || 'default'}
                                        className='gap-2'
                                        loading={action.loading}
                                    >
                                        <Link href={action.href}>
                                            {action.icon}
                                            {action.label}
                                        </Link>
                                    </Button>
                                );
                            }

                            return (
                                <Button
                                    key={index}
                                    variant={action.variant || 'default'}
                                    onClick={action.onClick}
                                    loading={action.loading}
                                    className='gap-2'
                                >
                                    {action.icon}
                                    {action.label}
                                </Button>
                            );
                        })}
                    </div>
                )}
            </div>

            {children}
        </div>
    );
}

export { PageHeader };
export type { PageHeaderProps, ActionButton };