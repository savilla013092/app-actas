'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    LucideSearch,
    LucideFilter,
    LucideX,
    LucideChevronDown,
    LucideCalendar
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface FilterOption {
    label: string;
    value: string;
}

export interface FilterConfig {
    key: string;
    label: string;
    type: 'select' | 'date' | 'dateRange' | 'text';
    options?: FilterOption[];
    placeholder?: string;
}

interface AdvancedFiltersProps {
    filters: FilterConfig[];
    values: Record<string, any>;
    onChange: (key: string, value: any) => void;
    onClear: () => void;
    onApply?: () => void;
    searchPlaceholder?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    className?: string;
}

export function AdvancedFilters({
    filters,
    values,
    onChange,
    onClear,
    onApply,
    searchPlaceholder = 'Buscar...',
    searchValue = '',
    onSearchChange,
    className,
}: AdvancedFiltersProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasActiveFilters = Object.values(values).some(v => v !== '' && v !== null && v !== undefined);

    const activeFilterCount = Object.values(values).filter(v => v !== '' && v !== null && v !== undefined).length;

    return (
        <div className={cn('space-y-4', className)}>
            {/* Search Bar */}
            {onSearchChange && (
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            className="pl-10 pr-4"
                            placeholder={searchPlaceholder}
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>
                    {filters.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className={cn(
                                'flex items-center gap-2 shrink-0',
                                hasActiveFilters && 'border-primary text-primary'
                            )}
                        >
                            <LucideFilter className="h-4 w-4" />
                            <span>Filtros</span>
                            {activeFilterCount > 0 && (
                                <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                            <LucideChevronDown className={cn(
                                'h-4 w-4 transition-transform',
                                isExpanded && 'rotate-180'
                            )} />
                        </Button>
                    )}
                </div>
            )}

            {/* Expanded Filters */}
            {isExpanded && filters.length > 0 && (
                <div className="animate-slide-down bg-muted/50 rounded-xl p-4 border border-border/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filters.map((filter) => (
                            <div key={filter.key} className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">
                                    {filter.label}
                                </label>
                                {filter.type === 'select' && (
                                    <select
                                        className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={values[filter.key] || ''}
                                        onChange={(e) => onChange(filter.key, e.target.value)}
                                    >
                                        <option value="">Todos</option>
                                        {filter.options?.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {filter.type === 'text' && (
                                    <Input
                                        placeholder={filter.placeholder}
                                        value={values[filter.key] || ''}
                                        onChange={(e) => onChange(filter.key, e.target.value)}
                                    />
                                )}
                                {filter.type === 'date' && (
                                    <div className="relative">
                                        <Input
                                            type="date"
                                            value={values[filter.key] || ''}
                                            onChange={(e) => onChange(filter.key, e.target.value)}
                                            className="pr-10"
                                        />
                                        <LucideCalendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    </div>
                                )}
                                {filter.type === 'dateRange' && (
                                    <div className="flex gap-2">
                                        <Input
                                            type="date"
                                            placeholder="Desde"
                                            value={values[`${filter.key}_from`] || ''}
                                            onChange={(e) => onChange(`${filter.key}_from`, e.target.value)}
                                            className="text-xs"
                                        />
                                        <Input
                                            type="date"
                                            placeholder="Hasta"
                                            value={values[`${filter.key}_to`] || ''}
                                            onChange={(e) => onChange(`${filter.key}_to`, e.target.value)}
                                            className="text-xs"
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border/50">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClear}
                            disabled={!hasActiveFilters}
                            className="text-muted-foreground"
                        >
                            <LucideX className="h-4 w-4 mr-1" />
                            Limpiar filtros
                        </Button>
                        {onApply && (
                            <Button size="sm" onClick={onApply}>
                                Aplicar
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
