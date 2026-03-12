'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    LucideBox,
    LucideDownload,
    LucideEye,
    LucideHome,
    LucideMapPin,
    LucidePlus,
} from 'lucide-react';

import { PageHeader, type ActionButton } from '@/components/layout/PageHeader';
import { AdvancedFilters, FilterConfig } from '@/components/filters/AdvancedFilters';
import { ActivoForm } from '@/components/forms/ActivoForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { getAssetClassification } from '@/lib/utils/assetClassification';
import { exportToExcel, activosExportColumns } from '@/lib/utils/export';
import { obtenerActivosPaginados } from '@/services/activoService';
import { Activo } from '@/types/activo';

const PAGE_SIZE = 24;

type ClassifiedActivo = Activo & {
    classificationCode?: string;
    classificationName: string;
};

const mergeActivos = (current: Activo[], incoming: Activo[]) => {
    const itemsById = new Map(current.map(item => [item.id, item]));
    incoming.forEach(item => {
        itemsById.set(item.id, item);
    });

    return Array.from(itemsById.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
};

const getEstadoVariant = (estado: Activo['estado']) => {
    if (estado === 'activo') {
        return 'success' as const;
    }

    if (estado === 'mantenimiento' || estado === 'traslado') {
        return 'warning' as const;
    }

    return 'outline' as const;
};

export default function ActivosPage() {
    const { user, isCustodio } = useAuth();
    const isCustodioRole = isCustodio();
    const [activos, setActivos] = useState<Activo[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadingAll, setLoadingAll] = useState(false);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingActivo, setEditingActivo] = useState<Activo | null>(null);
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [isExporting, setIsExporting] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const deferredSearch = useDeferredValue(search);

    useEffect(() => {
        let active = true;

        async function loadInitialPage() {
            if (!user) {
                return;
            }

            setLoading(true);

            try {
                const page = await obtenerActivosPaginados({
                    custodioId: isCustodioRole ? user.uid : undefined,
                    pageSize: PAGE_SIZE,
                });

                if (!active) {
                    return;
                }

                setActivos(page.items);
                setNextCursor(page.nextCursor);
                setTotalCount(page.totalCount);
                setHasMore(page.totalCount > page.items.length);
            } catch (error) {
                console.error('Error loading activos:', error);
                if (active) {
                    setActivos([]);
                    setNextCursor(null);
                    setTotalCount(0);
                    setHasMore(false);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        void loadInitialPage();

        return () => {
            active = false;
        };
    }, [user, isCustodioRole]);

    const handleReloadFirstPage = async () => {
        if (!user) {
            return;
        }

        setLoading(true);

        try {
            const page = await obtenerActivosPaginados({
                custodioId: isCustodioRole ? user.uid : undefined,
                pageSize: PAGE_SIZE,
            });

            setActivos(page.items);
            setNextCursor(page.nextCursor);
            setTotalCount(page.totalCount);
            setHasMore(page.totalCount > page.items.length);
        } catch (error) {
            console.error('Error reloading activos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = async () => {
        if (!user || !nextCursor || !hasMore) {
            return;
        }

        setLoadingMore(true);

        try {
            const page = await obtenerActivosPaginados({
                custodioId: isCustodioRole ? user.uid : undefined,
                cursor: nextCursor,
                pageSize: PAGE_SIZE,
            });

            const mergedItems = mergeActivos(activos, page.items);
            setActivos(mergedItems);
            setNextCursor(page.nextCursor);
            setTotalCount(page.totalCount);
            setHasMore(page.totalCount > mergedItems.length);
        } catch (error) {
            console.error('Error loading more activos:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleLoadAll = async () => {
        if (!user || !nextCursor || !hasMore) {
            return;
        }

        setLoadingAll(true);

        try {
            let cursor: string | null = nextCursor;
            let combinedItems = [...activos];
            let combinedTotal = totalCount;
            let canContinue: boolean = hasMore;

            while (cursor && canContinue) {
                const page = await obtenerActivosPaginados({
                    custodioId: isCustodioRole ? user.uid : undefined,
                    cursor,
                    pageSize: PAGE_SIZE,
                });

                combinedItems = mergeActivos(combinedItems, page.items);
                combinedTotal = page.totalCount;
                cursor = page.nextCursor;
                canContinue = page.totalCount > combinedItems.length && Boolean(cursor);
            }

            setActivos(combinedItems);
            setNextCursor(cursor);
            setTotalCount(combinedTotal);
            setHasMore(combinedTotal > combinedItems.length);
        } catch (error) {
            console.error('Error loading all activos:', error);
        } finally {
            setLoadingAll(false);
        }
    };

    const handleFormSuccess = async () => {
        setShowForm(false);
        setEditingActivo(null);
        await handleReloadFirstPage();
    };

    const handleEditActivo = (activo: Activo) => {
        setEditingActivo(activo);
        setShowForm(true);
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilterValues(prev => ({ ...prev, [key]: value }));
    };

    const handleClearFilters = () => {
        setFilterValues({});
        setSearch('');
    };

    const classifiedActivos = useMemo<ClassifiedActivo[]>(() => {
        return activos.map(activo => {
            const classification = getAssetClassification(activo.codigo, activo.categoria);
            return {
                ...activo,
                classificationCode: classification.classificationCode,
                classificationName: classification.classificationName,
            };
        });
    }, [activos]);

    const uniqueCategorias = useMemo(() => {
        const categories = Array.from(
            new Set(classifiedActivos.map(activo => activo.classificationName).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));

        return categories.map(category => ({ label: category, value: category }));
    }, [classifiedActivos]);

    const uniqueUbicaciones = useMemo(() => {
        const ubicaciones = Array.from(new Set(classifiedActivos.map(activo => activo.ubicacion).filter(Boolean)));
        return ubicaciones.sort((a, b) => a.localeCompare(b)).map(ubicacion => ({ label: ubicacion, value: ubicacion }));
    }, [classifiedActivos]);

    const uniqueEstados = useMemo(() => [
        { label: 'Activo', value: 'activo' },
        { label: 'En mantenimiento', value: 'mantenimiento' },
        { label: 'Traslado', value: 'traslado' },
        { label: 'Dado de baja', value: 'baja' },
    ], []);

    const filterConfig: FilterConfig[] = [
        {
            key: 'categoria',
            label: 'Categoria',
            type: 'select',
            options: uniqueCategorias,
        },
        {
            key: 'ubicacion',
            label: 'Ubicacion',
            type: 'select',
            options: uniqueUbicaciones,
        },
        {
            key: 'estado',
            label: 'Estado',
            type: 'select',
            options: uniqueEstados,
        },
    ];

    const filteredActivos = useMemo(() => {
        const normalizedSearch = deferredSearch.trim().toLowerCase();

        return classifiedActivos.filter(activo => {
            const matchesSearch = !normalizedSearch ||
                activo.codigo.toLowerCase().includes(normalizedSearch) ||
                activo.descripcion.toLowerCase().includes(normalizedSearch) ||
                activo.custodioNombre.toLowerCase().includes(normalizedSearch);

            const matchesCategoria = !filterValues.categoria || activo.classificationName === filterValues.categoria;
            const matchesUbicacion = !filterValues.ubicacion || activo.ubicacion === filterValues.ubicacion;
            const matchesEstado = !filterValues.estado || activo.estado === filterValues.estado;

            return matchesSearch && matchesCategoria && matchesUbicacion && matchesEstado;
        });
    }, [classifiedActivos, deferredSearch, filterValues]);

    const groupedActivos = useMemo(() => {
        const groups = new Map<string, ClassifiedActivo[]>();

        filteredActivos.forEach(activo => {
            const currentItems = groups.get(activo.classificationName) || [];
            currentItems.push(activo);
            groups.set(activo.classificationName, currentItems);
        });

        return Array.from(groups.entries())
            .map(([classificationName, items]) => ({
                classificationName,
                items: [...items].sort((a, b) => a.codigo.localeCompare(b.codigo)),
            }))
            .sort((a, b) => a.classificationName.localeCompare(b.classificationName));
    }, [filteredActivos]);

    const loadedCount = activos.length;
    const allLoaded = totalCount === 0 || loadedCount >= totalCount;
    const filteredCount = filteredActivos.length;
    const searchIsPartial = !allLoaded && Boolean(deferredSearch.trim() || Object.values(filterValues).some(Boolean));

    const handleExport = async () => {
        setIsExporting(true);
        try {
            exportToExcel(filteredActivos, activosExportColumns, 'activos_serviciudad', 'Activos');
        } catch (error) {
            console.error('Error exporting:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const headerActions: ActionButton[] = [
        {
            label: 'Menu principal',
            href: '/dashboard',
            icon: <LucideHome size={16} />,
            variant: 'outline',
        },
    ];

    if (!isCustodioRole) {
        headerActions.push(
            {
                label: 'Exportar',
                onClick: handleExport,
                icon: <LucideDownload size={16} />,
                variant: 'outline',
                loading: isExporting,
            },
            {
                label: 'Nuevo activo',
                onClick: () => {
                    setEditingActivo(null);
                    setShowForm(true);
                },
                icon: <LucidePlus size={16} />,
            }
        );
    }

    if (loading) {
        return (
            <div className='space-y-6'>
                <PageHeader
                    title='Inventario de Activos'
                    subtitle='Cargando inventario...'
                    breadcrumbItems={[{ label: 'Activos' }]}
                    actions={headerActions}
                />
                <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
                    {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
                </div>
            </div>
        );
    }

    return (
        <div className='space-y-6'>
            <PageHeader
                title='Inventario de Activos'
                subtitle={`${filteredCount} visibles - ${loadedCount} de ${totalCount} activos cargados`}
                breadcrumbItems={[{ label: 'Activos' }]}
                actions={headerActions}
            />

            <Card className='border-border/50 p-4'>
                <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
                    <div className='space-y-1'>
                        <p className='text-sm font-semibold text-foreground'>
                            {allLoaded
                                ? 'Todo el inventario cargado en pantalla.'
                                : 'La carga inicial es parcial para abrir la vista mas rapido.'}
                        </p>
                        <p className='text-sm text-muted-foreground'>
                            {allLoaded
                                ? 'La busqueda y los filtros ya cubren todos los activos disponibles.'
                                : 'La busqueda y los filtros solo trabajan sobre los activos ya cargados. Usa "Cargar mas" o "Cargar todos" para ampliar el alcance.'}
                        </p>
                    </div>
                    {!allLoaded && (
                        <div className='flex flex-col gap-2 sm:flex-row'>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => void handleLoadMore()}
                                loading={loadingMore}
                            >
                                Cargar mas
                            </Button>
                            <Button
                                type='button'
                                onClick={() => void handleLoadAll()}
                                loading={loadingAll}
                            >
                                Cargar todos
                            </Button>
                        </div>
                    )}
                </div>
            </Card>

            <AdvancedFilters
                filters={filterConfig}
                values={filterValues}
                onChange={handleFilterChange}
                onClear={handleClearFilters}
                searchPlaceholder='Buscar por codigo, descripcion o custodio...'
                searchValue={search}
                onSearchChange={setSearch}
            />

            {searchIsPartial && (
                <Badge variant='warning' className='w-fit'>
                    Busqueda parcial sobre {loadedCount} activos cargados.
                </Badge>
            )}

            {groupedActivos.length > 0 ? (
                <div className='space-y-8'>
                    {groupedActivos.map(group => (
                        <section key={group.classificationName} className='space-y-4'>
                            <div className='flex items-center justify-between gap-3 border-b border-border/60 pb-3'>
                                <div>
                                    <h3 className='text-lg font-semibold text-foreground'>
                                        {group.classificationName}
                                    </h3>
                                    <p className='text-sm text-muted-foreground'>
                                        {group.items.length} activo{group.items.length === 1 ? '' : 's'}
                                    </p>
                                </div>
                                <Badge variant='outline'>{group.items.length}</Badge>
                            </div>

                            <div className='grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3'>
                                {group.items.map(activo => (
                                    <Card key={activo.id} className='border-border/50 p-6 hover-lift'>
                                        <div className='mb-4 flex items-start justify-between gap-3'>
                                            <Badge variant='default' size='sm'>
                                                {activo.classificationName}
                                            </Badge>
                                            <Badge variant={getEstadoVariant(activo.estado)} size='sm'>
                                                {activo.estado}
                                            </Badge>
                                        </div>

                                        <h3 className='mb-1 line-clamp-2 font-bold text-foreground'>
                                            {activo.descripcion}
                                        </h3>
                                        <p className='mb-4 text-sm font-mono text-muted-foreground'>
                                            {activo.codigo}
                                        </p>

                                        <div className='mb-6 space-y-2'>
                                            <div className='flex items-center gap-2 text-xs'>
                                                <LucideMapPin size={14} className='shrink-0 text-muted-foreground' />
                                                <span className='truncate font-medium text-foreground'>{activo.ubicacion}</span>
                                            </div>
                                            <div className='flex items-center gap-2 text-xs'>
                                                <div className='flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/20'>
                                                    <span className='text-[8px] font-bold text-primary'>
                                                        {activo.custodioNombre?.charAt(0)?.toUpperCase() || '?'}
                                                    </span>
                                                </div>
                                                <span className='truncate font-medium text-foreground'>{activo.custodioNombre}</span>
                                            </div>
                                        </div>

                                        <div className='flex gap-2'>
                                            <Button asChild variant='outline' className='w-full' size='sm'>
                                                <Link href={`/activos/${activo.id}`}>
                                                    <LucideEye size={16} className='mr-1' />
                                                    Ver
                                                </Link>
                                            </Button>
                                            {!isCustodioRole && (
                                                <Button asChild className='w-full' size='sm'>
                                                    <Link href={`/revision/nueva/${activo.id}`}>Revisar</Link>
                                                </Button>
                                            )}
                                        </div>

                                        {!isCustodioRole && (
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                className='mt-2 w-full text-xs text-muted-foreground hover:text-foreground'
                                                size='sm'
                                                onClick={() => handleEditActivo(activo)}
                                            >
                                                Editar informacion
                                            </Button>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                <div className='rounded-xl border border-dashed border-border bg-card py-16 text-center'>
                    <LucideBox className='mx-auto mb-4 text-muted-foreground' size={48} />
                    <p className='font-medium text-muted-foreground'>No se encontraron activos</p>
                    <p className='mt-1 text-sm text-muted-foreground'>
                        {search || Object.values(filterValues).some(v => v)
                            ? 'Intenta ajustar la busqueda o cargar mas activos.'
                            : 'No hay activos registrados en el sistema.'}
                    </p>
                </div>
            )}

            {showForm && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm'>
                    <div className='w-full max-w-2xl animate-scale-in'>
                        <ActivoForm
                            activo={editingActivo}
                            onSuccess={() => void handleFormSuccess()}
                            onCancel={() => {
                                setShowForm(false);
                                setEditingActivo(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}