'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    LucideAlertTriangle,
    LucideBox,
    LucideDownload,
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
import { SkeletonList, SkeletonTable } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { getAssetClassification } from '@/lib/utils/assetClassification';
import { getAssetLocation } from '@/lib/utils/assetLocation';
import { exportToExcel, activosExportColumns } from '@/lib/utils/export';
import { obtenerActivosPaginados } from '@/services/activoService';
import { Activo } from '@/types/activo';

const PAGE_SIZE = 50;

type ClassifiedActivo = Activo & {
    classificationCode?: string;
    classificationName: string;
    locationCode?: string;
    locationName: string;
    locationMapped: boolean;
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
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [activos, setActivos] = useState<Activo[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadingAll, setLoadingAll] = useState(false);
    const [search, setSearch] = useState('');
    const [showEditForm, setShowEditForm] = useState(false);
    const [editingActivo, setEditingActivo] = useState<Activo | null>(null);
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [isExporting, setIsExporting] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const deferredSearch = useDeferredValue(search);

    const userRole = user?.usuario?.rol;
    const isCustodioRole = userRole === 'custodio';
    const canManageActivos = userRole === 'admin' || userRole === 'logistica';
    const profileUnavailable = Boolean(user && !user.usuario);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        let active = true;

        async function loadInitialPage() {
            if (authLoading || !user) {
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
    }, [authLoading, user, isCustodioRole]);

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

    const handleFormSuccess = async (_activoId: string) => {
        setShowEditForm(false);
        setEditingActivo(null);
        await handleReloadFirstPage();
    };

    const handleEditActivo = (activo: Activo) => {
        setEditingActivo(activo);
        setShowEditForm(true);
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
            const location = getAssetLocation(activo.ubicacion);

            return {
                ...activo,
                classificationCode: classification.classificationCode,
                classificationName: classification.classificationName,
                locationCode: location.locationCode,
                locationName: location.locationName,
                locationMapped: location.isMapped,
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
        const ubicaciones = Array.from(new Set(classifiedActivos.map(activo => activo.locationName).filter(Boolean)));
        return ubicaciones
            .sort((a, b) => a.localeCompare(b))
            .map(ubicacion => ({ label: ubicacion, value: ubicacion }));
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
            label: 'Clasificacion',
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
                activo.custodioNombre.toLowerCase().includes(normalizedSearch) ||
                activo.locationName.toLowerCase().includes(normalizedSearch) ||
                (activo.serial || '').toLowerCase().includes(normalizedSearch);

            const matchesCategoria = !filterValues.categoria || activo.classificationName === filterValues.categoria;
            const matchesUbicacion = !filterValues.ubicacion || activo.locationName === filterValues.ubicacion;
            const matchesEstado = !filterValues.estado || activo.estado === filterValues.estado;

            return matchesSearch && matchesCategoria && matchesUbicacion && matchesEstado;
        });
    }, [classifiedActivos, deferredSearch, filterValues]);

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

    if (canManageActivos) {
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
                href: '/activos/nuevo',
                icon: <LucidePlus size={16} />,
            }
        );
    } else if (!isCustodioRole && !profileUnavailable) {
        headerActions.push({
            label: 'Exportar',
            onClick: handleExport,
            icon: <LucideDownload size={16} />,
            variant: 'outline',
            loading: isExporting,
        });
    }

    if (authLoading || !user) {
        return (
            <div className='flex min-h-[50vh] items-center justify-center'>
                <SkeletonList items={4} />
            </div>
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
                {profileUnavailable && (
                    <Card className='border-amber-200 bg-amber-50 p-4 text-amber-900'>
                        <div className='flex items-start gap-3'>
                            <LucideAlertTriangle className='mt-0.5 shrink-0' size={18} />
                            <p className='text-sm'>
                                Tu perfil no esta disponible. Puedes consultar el inventario, pero no crear ni editar activos hasta volver a iniciar sesion.
                            </p>
                        </div>
                    </Card>
                )}
                <div className='hidden lg:block'>
                    <SkeletonTable rows={8} />
                </div>
                <div className='lg:hidden'>
                    <SkeletonList items={6} />
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

            {profileUnavailable && (
                <Card className='border-amber-200 bg-amber-50 p-4 text-amber-900'>
                    <div className='flex items-start gap-3'>
                        <LucideAlertTriangle className='mt-0.5 shrink-0' size={18} />
                        <p className='text-sm'>
                            Tu perfil no esta disponible. Puedes consultar el inventario, pero no crear ni editar activos hasta volver a iniciar sesion.
                        </p>
                    </div>
                </Card>
            )}

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
                searchPlaceholder='Buscar por codigo, descripcion, custodio o serial...'
                searchValue={search}
                onSearchChange={setSearch}
            />

            {searchIsPartial && (
                <Badge variant='warning' className='w-fit'>
                    Busqueda parcial sobre {loadedCount} activos cargados.
                </Badge>
            )}

            {filteredActivos.length > 0 ? (
                <>
                    <div className='hidden lg:block'>
                        <Card className='overflow-hidden border-border/50'>
                            <div className='overflow-x-auto'>
                                <table className='min-w-full text-sm'>
                                    <thead className='bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground'>
                                        <tr>
                                            <th className='px-4 py-3 font-semibold'>Codigo</th>
                                            <th className='px-4 py-3 font-semibold'>Descripcion</th>
                                            <th className='px-4 py-3 font-semibold'>Serial</th>
                                            <th className='px-4 py-3 font-semibold'>Custodio</th>
                                            <th className='px-4 py-3 font-semibold'>Clasificacion</th>
                                            <th className='px-4 py-3 font-semibold'>Ubicacion</th>
                                            <th className='px-4 py-3 font-semibold'>Estado</th>
                                            <th className='px-4 py-3 font-semibold'>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className='divide-y divide-border/60'>
                                        {filteredActivos.map(activo => (
                                            <tr key={activo.id} className='hover:bg-muted/30'>
                                                <td className='px-4 py-3 align-top'>
                                                    <Link href={`/activos/${activo.id}`} className='font-mono text-xs font-semibold text-foreground hover:text-primary'>
                                                        {activo.codigo}
                                                    </Link>
                                                </td>
                                                <td className='px-4 py-3 align-top'>
                                                    <div className='min-w-[280px]'>
                                                        <p className='font-medium text-foreground'>{activo.descripcion}</p>
                                                        {(activo.marca || activo.modelo) && (
                                                            <p className='mt-1 text-xs text-muted-foreground'>
                                                                {[activo.marca, activo.modelo].filter(Boolean).join(' - ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className='px-4 py-3 align-top'>
                                                    <span className='font-mono text-xs text-foreground'>{activo.serial || 'S/N'}</span>
                                                </td>
                                                <td className='px-4 py-3 align-top'>
                                                    <span className='text-sm text-foreground'>{activo.custodioNombre || 'Sin asignar'}</span>
                                                </td>
                                                <td className='px-4 py-3 align-top'>
                                                    <Badge variant='outline' size='sm'>
                                                        {activo.classificationName}
                                                    </Badge>
                                                </td>
                                                <td className='px-4 py-3 align-top'>
                                                    <div className='flex items-start gap-2 text-sm text-foreground'>
                                                        <LucideMapPin size={14} className='mt-0.5 shrink-0 text-muted-foreground' />
                                                        <span className='max-w-[220px] truncate'>{activo.locationName}</span>
                                                    </div>
                                                </td>
                                                <td className='px-4 py-3 align-top'>
                                                    <Badge variant={getEstadoVariant(activo.estado)} size='sm'>
                                                        {activo.estado}
                                                    </Badge>
                                                </td>
                                                <td className='px-4 py-3 align-top'>
                                                    <div className='flex flex-wrap gap-2'>
                                                        <Button asChild variant='ghost' size='sm'>
                                                            <Link href={`/activos/${activo.id}`}>Ver</Link>
                                                        </Button>
                                                        {canManageActivos && (
                                                            <>
                                                                <Button asChild variant='ghost' size='sm'>
                                                                    <Link href={`/revision/nueva/${activo.id}`}>Revisar</Link>
                                                                </Button>
                                                                <Button
                                                                    type='button'
                                                                    variant='ghost'
                                                                    size='sm'
                                                                    onClick={() => handleEditActivo(activo)}
                                                                >
                                                                    Editar
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>

                    <div className='space-y-3 lg:hidden'>
                        {filteredActivos.map(activo => (
                            <Card key={activo.id} className='border-border/50 p-4'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div className='min-w-0 flex-1'>
                                        <Link href={`/activos/${activo.id}`} className='font-mono text-xs font-semibold text-foreground hover:text-primary'>
                                            {activo.codigo}
                                        </Link>
                                        <p className='mt-1 text-sm font-medium text-foreground'>{activo.descripcion}</p>
                                    </div>
                                    <Badge variant={getEstadoVariant(activo.estado)} size='sm'>
                                        {activo.estado}
                                    </Badge>
                                </div>

                                <div className='mt-3 space-y-2 text-xs'>
                                    <p className='text-foreground'>
                                        <span className='font-semibold text-muted-foreground'>Serial:</span> {activo.serial || 'S/N'}
                                    </p>
                                    <p className='text-foreground'>
                                        <span className='font-semibold text-muted-foreground'>Custodio:</span> {activo.custodioNombre || 'Sin asignar'}
                                    </p>
                                    <p className='text-foreground'>
                                        <span className='font-semibold text-muted-foreground'>Clasificacion:</span> {activo.classificationName}
                                    </p>
                                    <p className='text-foreground'>
                                        <span className='font-semibold text-muted-foreground'>Ubicacion:</span> {activo.locationName}
                                    </p>
                                </div>

                                <div className='mt-4 flex flex-wrap gap-2'>
                                    <Button asChild variant='outline' size='sm'>
                                        <Link href={`/activos/${activo.id}`}>Ver</Link>
                                    </Button>
                                    {canManageActivos && (
                                        <>
                                            <Button asChild variant='outline' size='sm'>
                                                <Link href={`/revision/nueva/${activo.id}`}>Revisar</Link>
                                            </Button>
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={() => handleEditActivo(activo)}
                                            >
                                                Editar
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
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

            {showEditForm && editingActivo && (
                <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm'>
                    <div className='w-full max-w-2xl animate-scale-in'>
                        <ActivoForm
                            activo={editingActivo}
                            onSuccess={(activoId) => void handleFormSuccess(activoId)}
                            onCancel={() => {
                                setShowEditForm(false);
                                setEditingActivo(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}