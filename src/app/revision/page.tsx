'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    LucideCheckCircle,
    LucideClock,
    LucideDownload,
    LucideFileText,
    LucideHome,
} from 'lucide-react';

import { PageHeader, type ActionButton } from '@/components/layout/PageHeader';
import { AdvancedFilters, FilterConfig } from '@/components/filters/AdvancedFilters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SkeletonList } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { exportToExcel, revisionesExportColumns } from '@/lib/utils/export';
import {
    obtenerRevisionesPendientesFirma,
    obtenerTodasLasRevisiones,
} from '@/services/revisionService';
import { Revision } from '@/types/revision';

export default function RevisionesPage() {
    const { user, isLogistica, isCustodio, isAdmin } = useAuth();
    const [revisiones, setRevisiones] = useState<Revision[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        let active = true;

        async function loadRevisiones() {
            if (!user) {
                return;
            }

            try {
                let items: Revision[] = [];

                if (isAdmin() || isLogistica()) {
                    items = await obtenerTodasLasRevisiones();
                } else if (isCustodio()) {
                    items = await obtenerRevisionesPendientesFirma(user.uid);
                }

                if (active) {
                    setRevisiones(items);
                }
            } catch (error) {
                console.error('Error loading revisiones:', error);
                if (active) {
                    setRevisiones([]);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        void loadRevisiones();

        return () => {
            active = false;
        };
    }, [user, isLogistica, isCustodio, isAdmin]);

    const formatDate = (date: Date | { seconds: number } | undefined) => {
        if (!date) return '';
        if (typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000).toLocaleDateString('es-CO');
        }
        return new Date(date).toLocaleDateString('es-CO');
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilterValues(prev => ({ ...prev, [key]: value }));
    };

    const handleClearFilters = () => {
        setFilterValues({});
        setSearch('');
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const dataToExport = filteredRevisiones.map(revision => ({
                ...revision,
                fecha: typeof revision.fecha === 'object' && revision.fecha !== null && 'seconds' in revision.fecha
                    ? new Date((revision.fecha as { seconds: number }).seconds * 1000).toISOString()
                    : revision.fecha,
            }));

            exportToExcel(dataToExport, revisionesExportColumns, 'revisiones_serviciudad', 'Revisiones');
        } catch (error) {
            console.error('Error exporting revisiones:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const uniqueEstados = useMemo(() => [
        { label: 'Borrador', value: 'borrador' },
        { label: 'Pendiente de firma', value: 'pendiente_firma_custodio' },
        { label: 'Generando PDF', value: 'firmada_completa' },
        { label: 'Completada', value: 'completada' },
        { label: 'Error', value: 'error_generacion' },
    ], []);

    const uniqueEstadosActivo = useMemo(() => {
        const estados = Array.from(new Set(revisiones.map(revision => revision.estadoActivo).filter(Boolean)));
        return estados.map(estado => ({
            label: estado.charAt(0).toUpperCase() + estado.slice(1),
            value: estado,
        }));
    }, [revisiones]);

    const uniqueRevisores = useMemo(() => {
        const revisores = Array.from(new Set(revisiones.map(revision => revision.revisorNombre).filter(Boolean)));
        return revisores.map(revisor => ({ label: revisor, value: revisor }));
    }, [revisiones]);

    const filterConfig: FilterConfig[] = [
        {
            key: 'estado',
            label: 'Estado proceso',
            type: 'select',
            options: uniqueEstados,
        },
        {
            key: 'estadoActivo',
            label: 'Estado activo',
            type: 'select',
            options: uniqueEstadosActivo,
        },
        ...(isAdmin() || isLogistica()
            ? [{
                key: 'revisor',
                label: 'Revisor',
                type: 'select' as const,
                options: uniqueRevisores,
            }]
            : []),
    ];

    const filteredRevisiones = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return revisiones.filter(revision => {
            const matchesSearch = !normalizedSearch ||
                revision.numeroActa?.toLowerCase().includes(normalizedSearch) ||
                revision.codigoActivo.toLowerCase().includes(normalizedSearch) ||
                revision.descripcionActivo.toLowerCase().includes(normalizedSearch) ||
                revision.custodioNombre.toLowerCase().includes(normalizedSearch);

            const matchesEstado = !filterValues.estado || revision.estado === filterValues.estado;
            const matchesEstadoActivo = !filterValues.estadoActivo || revision.estadoActivo === filterValues.estadoActivo;
            const matchesRevisor = !filterValues.revisor || revision.revisorNombre === filterValues.revisor;

            return matchesSearch && matchesEstado && matchesEstadoActivo && matchesRevisor;
        });
    }, [revisiones, search, filterValues]);

    const getEstadoBadge = (estado: string) => {
        switch (estado) {
            case 'borrador':
                return <Badge variant='secondary'>Borrador</Badge>;
            case 'pendiente_firma_custodio':
                return <Badge variant='pending' icon={<LucideClock size={10} />}>Pendiente firma</Badge>;
            case 'firmada_completa':
                return <Badge variant='info' icon={<LucideClock size={10} />}>Generando PDF...</Badge>;
            case 'completada':
                return <Badge variant='completed' icon={<LucideCheckCircle size={10} />}>Completada</Badge>;
            case 'error_generacion':
                return <Badge variant='error'>Error</Badge>;
            default:
                return <Badge variant='outline'>{estado}</Badge>;
        }
    };

    const headerSubtitle = isCustodio()
        ? `${filteredRevisiones.length} revisiones pendientes de tu firma`
        : `${filteredRevisiones.length} de ${revisiones.length} revisiones`;

    const headerActions: ActionButton[] = [
        {
            label: 'Menu principal',
            href: '/dashboard',
            icon: <LucideHome size={16} />,
            variant: 'outline',
        },
    ];

    if (!isCustodio() && revisiones.length > 0) {
        headerActions.push({
            label: 'Exportar Excel',
            onClick: handleExport,
            icon: <LucideDownload size={16} />,
            variant: 'outline',
            loading: isExporting,
        });
    }

    if (loading) {
        return (
            <div className='space-y-6'>
                <PageHeader
                    title='Historial de Revisiones'
                    subtitle='Cargando revisiones...'
                    breadcrumbItems={[{ label: 'Revisiones' }]}
                    actions={headerActions}
                />
                <SkeletonList items={5} />
            </div>
        );
    }

    return (
        <div className='space-y-6'>
            <PageHeader
                title='Historial de Revisiones'
                subtitle={headerSubtitle}
                breadcrumbItems={[{ label: 'Revisiones' }]}
                actions={headerActions}
            />

            {!isCustodio() && (
                <AdvancedFilters
                    filters={filterConfig}
                    values={filterValues}
                    onChange={handleFilterChange}
                    onClear={handleClearFilters}
                    searchPlaceholder='Buscar por acta, codigo, descripcion o custodio...'
                    searchValue={search}
                    onSearchChange={setSearch}
                />
            )}

            {filteredRevisiones.length > 0 ? (
                <div className='space-y-4'>
                    {filteredRevisiones.map(revision => (
                        <Link key={revision.id} href={`/revision/${revision.id}`}>
                            <Card className='cursor-pointer border-l-4 border-l-primary/30 p-5 hover:border-l-primary hover-lift'>
                                <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
                                    <div className='flex min-w-0 flex-1 items-center gap-4'>
                                        <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10'>
                                            <LucideFileText size={22} className='text-primary' />
                                        </div>
                                        <div className='min-w-0 flex-1'>
                                            <div className='mb-1 flex flex-wrap items-center gap-2'>
                                                <p className='font-bold text-foreground'>
                                                    {revision.numeroActa || 'PRE-ACTA'}
                                                </p>
                                                {getEstadoBadge(revision.estado)}
                                            </div>
                                            <p className='truncate text-sm text-muted-foreground'>
                                                <span className='font-medium text-foreground'>{revision.codigoActivo}</span>
                                                {' - '}{revision.descripcionActivo}
                                            </p>
                                            <p className='mt-1 text-xs text-muted-foreground'>
                                                <span className='font-medium'>Fecha:</span> {formatDate(revision.fecha)}
                                                <span className='mx-2'>-</span>
                                                <span className='font-medium'>Custodio:</span> {revision.custodioNombre}
                                            </p>
                                        </div>
                                    </div>

                                    <div className='flex shrink-0 items-center gap-4'>
                                        <div className='hidden text-right md:block'>
                                            <p className='mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>
                                                Estado activo
                                            </p>
                                            <Badge
                                                variant={
                                                    revision.estadoActivo === 'excelente' || revision.estadoActivo === 'bueno'
                                                        ? 'success'
                                                        : 'warning'
                                                }
                                            >
                                                {revision.estadoActivo}
                                            </Badge>
                                        </div>
                                        <Button variant='outline' size='sm'>
                                            {isCustodio() && revision.estado === 'pendiente_firma_custodio'
                                                ? 'Firmar'
                                                : 'Ver detalle'}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className='rounded-xl border border-dashed border-border bg-card py-16 text-center'>
                    <LucideFileText className='mx-auto mb-4 text-muted-foreground' size={48} />
                    <p className='font-medium text-muted-foreground'>No se encontraron revisiones</p>
                    <p className='mt-1 text-sm text-muted-foreground'>
                        {isCustodio()
                            ? 'No tienes revisiones pendientes de firma.'
                            : 'Intenta ajustar la busqueda o los filtros.'}
                    </p>
                    {isLogistica() && (
                        <Button asChild className='mt-4'>
                            <Link href='/activos'>Ir a Activos</Link>
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}