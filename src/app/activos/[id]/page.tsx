'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { obtenerActivo } from '@/services/activoService';
import { obtenerRevisionesPorActivo } from '@/services/revisionService';
import { Activo } from '@/types/activo';
import { Revision } from '@/types/revision';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { LucideBox, LucideHistory, LucideUser, LucideMapPin, LucideFileText, LucideClipboardCheck } from 'lucide-react';
import Link from 'next/link';

export default function ActivoDetailPage() {
    const { id } = useParams();
    const { isLogistica, isAdmin } = useAuth();
    const [activo, setActivo] = useState<Activo | null>(null);
    const [revisiones, setRevisiones] = useState<Revision[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingRevisiones, setLoadingRevisiones] = useState(true);

    useEffect(() => {
        async function loadData() {
            if (!id) return;
            try {
                const data = await obtenerActivo(id as string);
                setActivo(data);
            } catch (error) {
                console.error('Error loading activo:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

    useEffect(() => {
        async function loadRevisiones() {
            if (!id) return;
            try {
                const data = await obtenerRevisionesPorActivo(id as string);
                setRevisiones(data);
            } catch (error) {
                console.error('Error loading revisiones:', error);
            } finally {
                setLoadingRevisiones(false);
            }
        }
        loadRevisiones();
    }, [id]);

    const getEstadoBadge = (estado: string) => {
        switch (estado) {
            case 'completada':
                return <Badge variant="completed" size="sm" icon={<LucideFileText size={10} />}>Completada</Badge>;
            case 'pendiente_firma_custodio':
                return <Badge variant="pending" size="sm">Pendiente</Badge>;
            case 'firmada_completa':
                return <Badge variant="info" size="sm">Procesando</Badge>;
            default:
                return <Badge variant="secondary" size="sm">{estado}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!activo) {
        return <div className="text-center py-12 text-red-500">Activo no encontrado.</div>;
    }

    const breadcrumbItems = [
        { label: 'Activos', href: '/activos', icon: <LucideBox size={14} /> },
        { label: activo.codigo },
    ];

    const actions = (isLogistica() || isAdmin()) ? [
        {
            label: 'Realizar Revisión',
            href: `/revision/nueva/${activo.id}`,
            icon: <LucideClipboardCheck size={18} />,
        },
    ] : [];

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <PageHeader
                title={activo.descripcion}
                subtitle={`Código: ${activo.codigo}`}
                breadcrumbItems={breadcrumbItems}
                backHref="/activos"
                actions={actions}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 p-6 space-y-8 shadow-elegant border-border/50">
                    <section>
                        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2 border-b border-border pb-2">
                            <LucideBox size={20} className="text-primary" />
                            Detalles del Activo
                        </h3>
                        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Categoría</p>
                                <p className="text-foreground font-medium">{activo.categoria}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Estado</p>
                                <Badge variant={activo.estado === 'activo' ? 'success' : 'error'}>
                                    {activo.estado}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Marca / Modelo</p>
                                <p className="text-foreground font-medium">{activo.marca || 'N/A'} - {activo.modelo || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Serial</p>
                                <p className="text-foreground font-medium font-mono">{activo.serial || 'S/N'}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Ubicación / Dependencia</p>
                                <div className="flex items-center gap-2">
                                    <LucideMapPin size={16} className="text-muted-foreground" />
                                    <p className="text-foreground font-medium">{activo.ubicacion} - {activo.dependencia}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2 border-b border-border pb-2">
                            <LucideHistory size={20} className="text-primary" />
                            Historial de Revisiones
                        </h3>
                        {loadingRevisiones ? (
                            <div className="text-center py-8 bg-muted rounded-lg border border-border">
                                <Spinner size="sm" />
                                <p className="text-muted-foreground text-sm italic mt-2">Cargando historial...</p>
                            </div>
                        ) : revisiones.length > 0 ? (
                            <div className="space-y-3">
                                {revisiones.map((revision) => (
                                    <Link key={revision.id} href={`/revision/${revision.id}`}>
                                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors cursor-pointer border border-border/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border border-border shadow-sm">
                                                    <LucideFileText size={18} className="text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground text-sm">
                                                        {revision.numeroActa || `Borrador (${revision.id.substring(0, 6)})`}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(revision.fecha).toLocaleDateString('es-CO')} - {revision.revisorNombre}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="default" size="sm">{revision.estadoActivo}</Badge>
                                                {getEstadoBadge(revision.estado)}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-muted rounded-lg border border-border">
                                <LucideFileText className="mx-auto text-muted-foreground mb-2" size={32} />
                                <p className="text-muted-foreground text-sm">No hay revisiones registradas para este activo.</p>
                            </div>
                        )}
                    </section>
                </Card>

                <Card className="p-6 h-fit shadow-elegant border-border/50">
                    <h3 className="font-bold text-foreground mb-4 border-b border-border pb-2 flex items-center gap-2">
                        <LucideUser size={18} className="text-primary" />
                        Custodio Actual
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-bold text-foreground">{activo.custodioNombre}</p>
                            <p className="text-xs text-muted-foreground">ID: {activo.custodioId}</p>
                        </div>
                        <div className="pt-4 border-t">
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">Registrado el</p>
                            <p className="text-sm text-foreground">
                                {activo.creadoEn ? new Date(activo.creadoEn).toLocaleDateString('es-CO') : 'Sin fecha'}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
