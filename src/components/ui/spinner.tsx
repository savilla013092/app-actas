import { LucideLoader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SpinnerProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ className, size = 'md' }: SpinnerProps) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <LucideLoader2
            className={cn('animate-spin text-primary', sizeClasses[size], className)}
        />
    );
}
