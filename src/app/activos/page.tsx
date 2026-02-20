'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { obtenerTodosLosActivos, obtenerActivosPorCustodio } from '@/services/activoService';
import { Activo } from '@/types/activo';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { SkeletonCard } from '@/components/ui/skeleton';
import { AdvancedFilters, FilterConfig } from '@/components/filters/AdvancedFilters';
import { exportToExcel, activosExportColumns } from '@/lib/utils/export';
import { ActivoForm } from '@/components/forms/ActivoForm';
import { 
    LucidePlus, 
    LucideDownload, 
    LucideBox,
    LucideMapPin,
    LucideEye
} from 'lucide-react';
import Link from 'next/link';

export default function ActivosPage() {
    const { user, isCustodio } = useAuth();
    const [activos, setActivos] = useState<Activo[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingActivo, setEditingActivo] = useState<Activo | null>(null);
    const [filterValues, setFilterValues] = useState<Record<string, string>>({});
    const [isExporting, setIsExporting] = useState(false);

    const loadActivos = async (isCustodioRole: boolean) => {
        if (!user) return;
        setLoading(true);
        try {
            let items: Activo[];
            if (isCustodioRole) {
                items = await obtenerActivosPorCustodio(user.uid);
            } else {
                items = await obtenerTodosLosActivos();
            }
            setActivos(items);
        } catch (error) {
            console.error('Error loading activos:', error);
        } finally {
            setLoading(false);
        }
    };

    const isCustodioRole = isCustodio();

    useEffect(() => {
        if (!user) return;
        loadActivos(isCustodioRole);
    }, [user?.uid, isCustodioRole]);

    const handleFormSuccess = () => {
        setShowForm(false);
        setEditingActivo(null);
        loadActivos(isCustodioRole);
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

    const uniqueCategorias = useMemo(() => {
        const cats = Array.from(new Set(activos.map(a => a.categoria).filter(Boolean)));
        return cats.map(c => ({ label: c, value: c }));
    }, [activos]);

    const uniqueUbicaciones = useMemo(() => {
        const ubs = Array.from(new Set(activos.map(a => a.ubicacion).filter(Boolean)));
        return ubs.map(u => ({ label: u, value: u }));
    }, [activos]);

    const uniqueEstados = useMemo(() => [
        { label: 'Activo', value: 'activo' },
        { label: 'Inactivo', value: 'inactivo' },
        { label: 'En mantenimiento', value: 'mantenimiento' },
        { label: 'Dado de baja', value: 'baja' },
    ], []);

    const filterConfig: FilterConfig[] = [
        {
            key: 'categoria',
            label: 'Categoría',
            type: 'select',
            options: uniqueCategorias,
        },
        {
            key: 'ubicacion',
            label: 'Ubicación',
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
        return activos.filter(activo => {
            const searchLower = search.toLowerCase();
            const matchesSearch = !search || 
                activo.codigo.toLowerCase().includes(searchLower) ||
                activo.descripcion.toLowerCase().includes(searchLower) ||
                activo.custodioNombre.toLowerCase().includes(searchLower);

            const matchesCategoria = !filterValues.categoria || activo.categoria === filterValues.categoria;
            const matchesUbicacion = !filterValues.ubicacion || activo.ubicacion === filterValues.ubicacion;
            const matchesEstado = !filterValues.estado || activo.estado === filterValues.estado;

            return matchesSearch && matchesCategoria && matchesUbicacion && matchesEstado;
        });
    }, [activos, search, filterValues]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="h-8 w-64 bg-muted rounded animate-pulse mb-2" />
                        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Inventario de Activos</h2>
                    <p className="text-muted-foreground">
                        {filteredActivos.length} de {activos.length} activos
                    </p>
                </div>
                <div className="flex gap-3">
                    {!isCustodio() && (
                        <>
                            <Button
                                variant="outline"
                                onClick={handleExport}
                                loading={isExporting}
                                leftIcon={<LucideDownload size={18} />}
                            >
                                Exportar
                            </Button>
                            <Button
                                onClick={() => {
                                    setEditingActivo(null);
                                    setShowForm(true);
                                }}
                                leftIcon={<LucidePlus size={18} />}
                            >
                                Nuevo Activo
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Filters */}
            <AdvancedFilters
                filters={filterConfig}
                values={filterValues}
                onChange={handleFilterChange}
                onClear={handleClearFilters}
                searchPlaceholder="Buscar por código, descripción o custodio..."
                searchValue={search}
                onSearchChange={setSearch}
            />

            {/* Assets Grid */}
            {filteredActivos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredActivos.map((activo, index) => (
                        <Card 
                            key={activo.id} 
                            className="p-6 hover-lift border-border/50 animate-fade-in"
                            style={{ animationDelay: `${index * 30}ms` }}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <Badge variant="default" size="sm">
                                    {activo.categoria}
                                </Badge>
                                <Badge 
                                    variant={activo.estado === 'activo' ? 'success' : 'error'}
                                    size="sm"
                                >
                                    {activo.estado}
                                </Badge>
                            </div>
                            
                            <h3 className="font-bold text-foreground mb-1 line-clamp-2">
                                {activo.descripcion}
                            </h3>
                            <p className="text-sm text-muted-foreground font-mono mb-4">
                                {activo.codigo}
                            </p>

                            <div className="space-y-2 mb-6">
                                <div className="flex items-center gap-2 text-xs">
                                    <LucideMapPin size={14} className="text-muted-foreground shrink-0" />
                                    <span className="text-foreground font-medium truncate">{activo.ubicacion}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <div className="w-3.5 h-3.5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                        <span className="text-[8px] text-primary font-bold">
                                            {activo.custodioNombre?.charAt(0)?.toUpperCase() || '?'}
                                        </span>
                                    </div>
                                    <span className="text-foreground font-medium truncate">{activo.custodioNombre}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Link href={`/activos/${activo.id}`} className="flex-1">
                                    <Button variant="outline" className="w-full" size="sm">
                                        <LucideEye size={16} className="mr-1" />
                                        Ver
                                    </Button>
                                </Link>
                                {!isCustodio() && (
                                    <Link href={`/revision/nueva/${activo.id}`} className="flex-1">
                                        <Button className="w-full" size="sm">
                                            Revisar
                                        </Button>
                                    </Link>
                                )}
                            </div>
                            
                            {!isCustodio() && (
                                <Button
                                    variant="ghost"
                                    className="w-full text-xs mt-2 text-muted-foreground hover:text-foreground"
                                    size="sm"
                                    onClick={() => handleEditActivo(activo)}
                                >
                                    Editar información
                                </Button>
                            )}
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
                    <LucideBox className="mx-auto text-muted-foreground mb-4" size={48} />
                    <p className="text-muted-foreground font-medium">No se encontraron activos</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {search || Object.values(filterValues).some(v => v) 
                            ? 'Intenta ajustar los filtros de búsqueda'
                            : 'No hay activos registrados en el sistema'}
                    </p>
                </div>
            )}

            {/* Modal del Formulario */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl animate-scale-in">
                        <ActivoForm
                            activo={editingActivo}
                            onSuccess={handleFormSuccess}
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
