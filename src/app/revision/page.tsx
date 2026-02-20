'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
    obtenerRevisionesPorRevisor,
    obtenerRevisionesPendientesFirma,
    obtenerTodasLasRevisiones
} from '@/services/revisionService';
import { Revision } from '@/types/revision';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { SkeletonList } from '@/components/ui/skeleton';
import { AdvancedFilters, FilterConfig } from '@/components/filters/AdvancedFilters';
import { exportToExcel, revisionesExportColumns } from '@/lib/utils/export';
import { 
    LucideFileText, 
    LucideClock, 
    LucideCheckCircle, 
    LucideDownload,
    LucideSearch
} from 'lucide-react';
import Link from 'next/link';

export default function RevisionesPage() {
    const { user, isLogistica, isCustodio, isAdmin } = useAuth();
    const [revisiones, setRevisiones] = useState<Revision[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        async function loadRevisiones() {
            if (!user) return;
            try {
                let items: Revision[] = [];
                if (isAdmin() || isLogistica()) {
                    items = await obtenerTodasLasRevisiones();
                } else if (isCustodio()) {
                    items = await obtenerRevisionesPendientesFirma(user.uid);
                }
                setRevisiones(items);
            } catch (error) {
                console.error('Error loading revisiones:', error);
            } finally {
                setLoading(false);
            }
        }
        loadRevisiones();
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
            const dataToExport = filteredRevisiones.map(rev => ({
                ...rev,
                fecha: typeof rev.fecha === 'object' && rev.fecha !== null && 'seconds' in rev.fecha 
                    ? new Date((rev.fecha as { seconds: number }).seconds * 1000).toISOString()
                    : rev.fecha
            }));
            exportToExcel(dataToExport, revisionesExportColumns, 'revisiones_serviciudad', 'Revisiones');
        } catch (error) {
            console.error('Error exporting:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const uniqueEstados = useMemo(() => [
        { label: 'Borrador', value: 'borrador' },
        { label: 'Pendiente de Firma', value: 'pendiente_firma_custodio' },
        { label: 'Generando PDF', value: 'firmada_completa' },
        { label: 'Completada', value: 'completada' },
        { label: 'Error', value: 'error_generacion' },
    ], []);

    const uniqueEstadosActivo = useMemo(() => {
        const estados = Array.from(new Set(revisiones.map(r => r.estadoActivo).filter(Boolean)));
        return estados.map(e => ({ label: e.charAt(0).toUpperCase() + e.slice(1), value: e }));
    }, [revisiones]);

    const uniqueRevisores = useMemo(() => {
        const revisores = Array.from(new Set(revisiones.map(r => r.revisorNombre).filter(Boolean)));
        return revisores.map(r => ({ label: r, value: r }));
    }, [revisiones]);

    const filterConfig: FilterConfig[] = [
        {
            key: 'estado',
            label: 'Estado Proceso',
            type: 'select',
            options: uniqueEstados,
        },
        {
            key: 'estadoActivo',
            label: 'Estado Activo',
            type: 'select',
            options: uniqueEstadosActivo,
        },
        ...(isAdmin() || isLogistica() ? [{
            key: 'revisor',
            label: 'Revisor',
            type: 'select' as const,
            options: uniqueRevisores,
        }] : []),
    ];

    const filteredRevisiones = useMemo(() => {
        return revisiones.filter(revision => {
            const searchLower = search.toLowerCase();
            const matchesSearch = !search || 
                (revision.numeroActa?.toLowerCase().includes(searchLower)) ||
                revision.codigoActivo.toLowerCase().includes(searchLower) ||
                revision.descripcionActivo.toLowerCase().includes(searchLower) ||
                revision.custodioNombre.toLowerCase().includes(searchLower);

            const matchesEstado = !filterValues.estado || revision.estado === filterValues.estado;
            const matchesEstadoActivo = !filterValues.estadoActivo || revision.estadoActivo === filterValues.estadoActivo;
            const matchesRevisor = !filterValues.revisor || revision.revisorNombre === filterValues.revisor;

            return matchesSearch && matchesEstado && matchesEstadoActivo && matchesRevisor;
        });
    }, [revisiones, search, filterValues]);

    const getEstadoBadge = (estado: string) => {
        switch (estado) {
            case 'borrador':
                return <Badge variant="secondary">Borrador</Badge>;
            case 'pendiente_firma_custodio':
                return <Badge variant="pending" icon={<LucideClock size={10} />}>Pendiente Firma</Badge>;
            case 'firmada_completa':
                return <Badge variant="info" icon={<LucideClock size={10} />}>Generando PDF...</Badge>;
            case 'completada':
                return <Badge variant="completed" icon={<LucideCheckCircle size={10} />}>Completada</Badge>;
            case 'error_generacion':
                return <Badge variant="error">Error</Badge>;
            default:
                return <Badge variant="outline">{estado}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="h-8 w-64 bg-muted rounded animate-pulse mb-2" />
                        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                    </div>
                </div>
                <SkeletonList items={5} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Historial de Revisiones</h2>
                    <p className="text-muted-foreground">
                        {isCustodio()
                            ? `${filteredRevisiones.length} revisiones pendientes de tu firma`
                            : `${filteredRevisiones.length} de ${revisiones.length} revisiones`}
                    </p>
                </div>
                {!isCustodio() && revisiones.length > 0 && (
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        loading={isExporting}
                        leftIcon={<LucideDownload size={18} />}
                    >
                        Exportar Excel
                    </Button>
                )}
            </div>

            {/* Filters */}
            {!isCustodio() && (
                <AdvancedFilters
                    filters={filterConfig}
                    values={filterValues}
                    onChange={handleFilterChange}
                    onClear={handleClearFilters}
                    searchPlaceholder="Buscar por acta, código, descripción o custodio..."
                    searchValue={search}
                    onSearchChange={setSearch}
                />
            )}

            {/* Revisions List */}
            {filteredRevisiones.length > 0 ? (
                <div className="space-y-4">
                    {filteredRevisiones.map((revision, index) => (
                        <Link key={revision.id} href={`/revision/${revision.id}`}>
                            <Card 
                                className="p-5 hover-lift cursor-pointer border-l-4 border-l-primary/30 hover:border-l-primary animate-fade-in"
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                                            <LucideFileText size={22} className="text-primary" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <p className="font-bold text-foreground">
                                                    {revision.numeroActa || `PRE-ACTA`}
                                                </p>
                                                {getEstadoBadge(revision.estado)}
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">
                                                <span className="font-medium text-foreground">{revision.codigoActivo}</span>
                                                {' - '}{revision.descripcionActivo}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                <span className="font-medium">Fecha:</span> {formatDate(revision.fecha)}
                                                <span className="mx-2">•</span>
                                                <span className="font-medium">Custodio:</span> {revision.custodioNombre}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="text-right hidden md:block">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
                                                Estado Activo
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
                                        <Button variant="outline" size="sm">
                                            {isCustodio() && revision.estado === 'pendiente_firma_custodio' 
                                                ? 'Firmar' 
                                                : 'Ver Detalle'}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
                    <LucideFileText className="mx-auto text-muted-foreground mb-4" size={48} />
                    <p className="text-muted-foreground font-medium">No se encontraron revisiones</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {isCustodio()
                            ? 'No tienes revisiones pendientes de firma'
                            : 'Intenta ajustar los filtros de búsqueda'}
                    </p>
                    {isLogistica() && (
                        <Link href="/activos">
                            <Button className="mt-4">
                                Ir a Activos
                            </Button>
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
