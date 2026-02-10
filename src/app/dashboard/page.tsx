'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
    obtenerEstadisticasRevisiones,
    obtenerRevisionesRecientes,
    obtenerTodasPendientesFirma,
    obtenerRevisionesPendientesFirma
} from '@/services/revisionService';
import { Revision } from '@/types/revision';
import Link from 'next/link';
import {
    LucideClipboardCheck,
    LucideClock,
    LucideAlertTriangle,
    LucideFileText
} from 'lucide-react';

interface Stats {
    totalRevisiones: number;
    pendientesFirma: number;
    actasMalEstado: number;
    actasCompletadas: number;
}

export default function DashboardPage() {
    const { user, isCustodio } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [revisionesRecientes, setRevisionesRecientes] = useState<Revision[]>([]);
    const [pendientesFirma, setPendientesFirma] = useState<Revision[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadDashboardData() {
            if (!user) return;
            try {
                const estadisticas = await obtenerEstadisticasRevisiones();
                setStats(estadisticas);

                const recientes = await obtenerRevisionesRecientes(3);
                setRevisionesRecientes(recientes);

                // Para custodios, solo sus revisiones pendientes
                if (isCustodio()) {
                    const pendientes = await obtenerRevisionesPendientesFirma(user.uid);
                    setPendientesFirma(pendientes);
                } else {
                    const pendientes = await obtenerTodasPendientesFirma();
                    setPendientesFirma(pendientes.slice(0, 5));
                }
            } catch (error) {
                console.error('Error loading dashboard:', error);
            } finally {
                setLoading(false);
            }
        }
        loadDashboardData();
    }, [user, isCustodio]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner size="lg" />
            </div>
        );
    }

    const statsData = [
        {
            label: 'Revisiones Realizadas',
            value: stats?.totalRevisiones.toString() || '0',
            icon: LucideClipboardCheck,
            color: 'text-green-600',
            bg: 'bg-green-100'
        },
        {
            label: 'Pendientes por Firmar',
            value: stats?.pendientesFirma.toString() || '0',
            icon: LucideClock,
            color: 'text-orange-600',
            bg: 'bg-orange-100'
        },
        {
            label: 'Activos en Mal Estado',
            value: stats?.actasMalEstado.toString() || '0',
            icon: LucideAlertTriangle,
            color: 'text-red-600',
            bg: 'bg-red-100'
        },
        {
            label: 'Actas Generadas',
            value: stats?.actasCompletadas.toString() || '0',
            icon: LucideFileText,
            color: 'text-blue-600',
            bg: 'bg-blue-100'
        },
    ];

    const formatDate = (date: Date | { seconds: number } | undefined) => {
        if (!date) return '';
        // Handle Firestore Timestamp
        if (typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000).toLocaleDateString('es-CO');
        }
        return new Date(date).toLocaleDateString('es-CO');
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-foreground">Bienvenido de nuevo, {user?.usuario?.nombre}</h2>
                <p className="text-muted-foreground">Aquí tienes un resumen de la actividad reciente.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsData.map((stat) => (
                    <Card key={stat.label} className="p-6">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-6">
                    <h3 className="font-bold text-foreground mb-4">Revisiones Recientes</h3>
                    <div className="space-y-4">
                        {revisionesRecientes.length > 0 ? (
                            revisionesRecientes.map((revision) => (
                                <Link href={`/revision/${revision.id}`} key={revision.id}>
                                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted/70 transition-colors cursor-pointer border border-border">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border border-border text-primary">
                                                <LucideFileText size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-foreground">{revision.numeroActa || 'Sin número'}</p>
                                                <p className="text-xs text-muted-foreground">{revision.descripcionActivo} - {formatDate(revision.fecha)}</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full uppercase">
                                            Completada
                                        </span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No hay revisiones completadas todavía.
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="font-bold text-foreground mb-4">
                        {isCustodio() ? 'Mis Pendientes de Firma' : 'Pendientes de Firma'}
                    </h3>
                    <div className="space-y-4">
                        {pendientesFirma.length > 0 ? (
                            pendientesFirma.map((revision) => (
                                <Link href={`/revision/${revision.id}`} key={revision.id}>
                                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted/70 transition-colors cursor-pointer border border-border">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border border-border text-orange-500">
                                                <LucideClock size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-foreground">Revisión {revision.codigoActivo}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Pendiente firma {isCustodio() ? '' : `de ${revision.custodioNombre}`}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-primary text-sm font-bold hover:underline">
                                            {isCustodio() ? 'Firmar' : 'Ver'}
                                        </span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No hay revisiones pendientes de firma.
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
