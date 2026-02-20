'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import {
    obtenerEstadisticasRevisiones,
    obtenerRevisionesRecientes,
    obtenerTodasPendientesFirma,
    obtenerRevisionesPendientesFirma,
    obtenerTodasLasRevisiones
} from '@/services/revisionService';
import { obtenerTodosLosActivos } from '@/services/activoService';
import { Revision } from '@/types/revision';
import { Activo } from '@/types/activo';
import { RevisionesPorMesChart, ActivosPorEstadoChart, CategoriaChart, TendenciaChart } from '@/components/charts/StatsChart';
import Link from 'next/link';
import {
    LucideClipboardCheck,
    LucideClock,
    LucideAlertTriangle,
    LucideFileText,
    LucideTrendingUp,
    LucideArrowRight,
    LucideDownload
} from 'lucide-react';

interface Stats {
    totalRevisiones: number;
    pendientesFirma: number;
    actasMalEstado: number;
    actasCompletadas: number;
}

export default function DashboardPage() {
    const { user, isCustodio, isLogistica, isAdmin } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [revisionesRecientes, setRevisionesRecientes] = useState<Revision[]>([]);
    const [pendientesFirma, setPendientesFirma] = useState<Revision[]>([]);
    const [allRevisiones, setAllRevisiones] = useState<Revision[]>([]);
    const [allActivos, setAllActivos] = useState<Activo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadDashboardData() {
            if (!user) return;
            try {
                const estadisticas = await obtenerEstadisticasRevisiones();
                setStats(estadisticas);

                const recientes = await obtenerRevisionesRecientes(5);
                setRevisionesRecientes(recientes);

                if (isCustodio()) {
                    const pendientes = await obtenerRevisionesPendientesFirma(user.uid);
                    setPendientesFirma(pendientes);
                } else {
                    const pendientes = await obtenerTodasPendientesFirma();
                    setPendientesFirma(pendientes.slice(0, 5));
                    
                    const revisiones = await obtenerTodasLasRevisiones();
                    setAllRevisiones(revisiones);
                    
                    const activos = await obtenerTodosLosActivos();
                    setAllActivos(activos);
                }
            } catch (error) {
                console.error('Error loading dashboard:', error);
            } finally {
                setLoading(false);
            }
        }
        loadDashboardData();
    }, [user, isCustodio]);

    const formatDate = (date: Date | { seconds: number } | undefined) => {
        if (!date) return '';
        if (typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000).toLocaleDateString('es-CO');
        }
        return new Date(date).toLocaleDateString('es-CO');
    };

    const chartData = useMemo(() => {
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const revisionesPorMes: Record<string, number> = {};
        meses.forEach(m => revisionesPorMes[m] = 0);

        allRevisiones.forEach(rev => {
            let date: Date;
            if (typeof rev.fecha === 'object' && rev.fecha !== null && 'seconds' in rev.fecha) {
                date = new Date((rev.fecha as { seconds: number }).seconds * 1000);
            } else {
                date = new Date(rev.fecha as Date);
            }
            const mesIndex = date.getMonth();
            revisionesPorMes[meses[mesIndex]]++;
        });

        const revisionesPorMesData = meses.map(mes => ({
            name: mes,
            value: revisionesPorMes[mes]
        }));

        const estadoCount: Record<string, number> = {};
        allActivos.forEach(activo => {
            const estado = activo.estado || 'activo';
            estadoCount[estado] = (estadoCount[estado] || 0) + 1;
        });

        const activosPorEstadoData = Object.entries(estadoCount).map(([name, value], idx) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            color: ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6'][idx] || '#8b5cf6'
        }));

        const categoriaCount: Record<string, number> = {};
        allActivos.forEach(activo => {
            const cat = activo.categoria || 'Sin categoría';
            categoriaCount[cat] = (categoriaCount[cat] || 0) + 1;
        });

        const activosPorCategoriaData = Object.entries(categoriaCount)
            .map(([name, value]) => ({ name: name.substring(0, 15), value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);

        const ultimos6Meses: { name: string; value: number }[] = [];
        const ahora = new Date();
        for (let i = 5; i >= 0; i--) {
            const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
            const mesNombre = fecha.toLocaleString('es-CO', { month: 'short' });
            let count = 0;
            
            allRevisiones.forEach(rev => {
                let revDate: Date;
                if (typeof rev.fecha === 'object' && rev.fecha !== null && 'seconds' in rev.fecha) {
                    revDate = new Date((rev.fecha as { seconds: number }).seconds * 1000);
                } else {
                    revDate = new Date(rev.fecha as Date);
                }
                if (revDate.getMonth() === fecha.getMonth() && revDate.getFullYear() === fecha.getFullYear()) {
                    count++;
                }
            });
            
            ultimos6Meses.push({ name: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1), value: count });
        }

        return {
            revisionesPorMes: revisionesPorMesData,
            activosPorEstado: activosPorEstadoData,
            activosPorCategoria: activosPorCategoriaData,
            tendencia: ultimos6Meses
        };
    }, [allRevisiones, allActivos]);

    if (loading) {
        return (
            <div className="space-y-8">
                <div>
                    <div className="h-8 w-64 bg-muted rounded animate-pulse mb-2" />
                    <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                </div>
            </div>
        );
    }

    const statsData = [
        {
            label: 'Revisiones Realizadas',
            value: stats?.totalRevisiones.toString() || '0',
            icon: LucideClipboardCheck,
            color: 'text-emerald-600',
            bg: 'bg-emerald-100',
            trend: '+12%'
        },
        {
            label: 'Pendientes por Firmar',
            value: stats?.pendientesFirma.toString() || '0',
            icon: LucideClock,
            color: 'text-amber-600',
            bg: 'bg-amber-100',
            trend: null
        },
        {
            label: 'Activos en Mal Estado',
            value: stats?.actasMalEstado.toString() || '0',
            icon: LucideAlertTriangle,
            color: 'text-red-600',
            bg: 'bg-red-100',
            trend: null
        },
        {
            label: 'Actas Generadas',
            value: stats?.actasCompletadas.toString() || '0',
            icon: LucideFileText,
            color: 'text-primary',
            bg: 'bg-primary/10',
            trend: '+8%'
        },
    ];

    return (
        <div className="space-y-8">
            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">
                        Bienvenido, {user?.usuario?.nombre?.split(' ')[0]}
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Resumen de actividad - SERVICIUDAD ESP
                    </p>
                </div>
                {(isLogistica() || isAdmin()) && (
                    <Link href="/activos">
                        <Button className="flex items-center gap-2">
                            <LucideTrendingUp size={18} />
                            Nueva Revisión
                        </Button>
                    </Link>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsData.map((stat, index) => (
                    <Card 
                        key={stat.label} 
                        className="p-6 hover-lift animate-fade-in border-border/50"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div className="flex items-start justify-between">
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                <stat.icon size={22} />
                            </div>
                            {stat.trend && (
                                <Badge variant="success" size="sm">
                                    {stat.trend}
                                </Badge>
                            )}
                        </div>
                        <div className="mt-4">
                            <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Charts Section - Only for Admin/Logistica */}
            {!isCustodio() && (allRevisiones.length > 0 || allActivos.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <TendenciaChart data={chartData.tendencia} title="Tendencia Últimos 6 Meses" />
                    <ActivosPorEstadoChart data={chartData.activosPorEstado} />
                </div>
            )}

            {!isCustodio() && allActivos.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <CategoriaChart data={chartData.activosPorCategoria} title="Activos por Categoría" />
                    <RevisionesPorMesChart data={chartData.revisionesPorMes} />
                </div>
            )}

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Revisions */}
                <Card className="p-6 shadow-elegant border-border/50">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-foreground text-lg">Revisiones Recientes</h3>
                        <Link href="/revision">
                            <Button variant="ghost" size="sm" className="text-primary">
                                Ver todas
                                <LucideArrowRight size={16} className="ml-1" />
                            </Button>
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {revisionesRecientes.length > 0 ? (
                            revisionesRecientes.map((revision, index) => (
                                <Link href={`/revision/${revision.id}`} key={revision.id}>
                                    <div 
                                        className="flex items-center justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted transition-all duration-200 cursor-pointer border border-border/50 animate-slide-up"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border border-border shadow-sm">
                                                <LucideFileText size={18} className="text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-foreground text-sm">
                                                    {revision.numeroActa || 'Sin número'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {revision.codigoActivo} • {formatDate(revision.fecha)}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="completed" size="sm">Completada</Badge>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <LucideFileText className="mx-auto mb-3 opacity-50" size={40} />
                                <p>No hay revisiones recientes</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Pending Signatures */}
                <Card className="p-6 shadow-elegant border-border/50">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-foreground text-lg">
                            {isCustodio() ? 'Mis Pendientes' : 'Pendientes de Firma'}
                        </h3>
                        <Badge variant="pending" size="sm">
                            {pendientesFirma.length} pendiente{pendientesFirma.length !== 1 ? 's' : ''}
                        </Badge>
                    </div>
                    <div className="space-y-3">
                        {pendientesFirma.length > 0 ? (
                            pendientesFirma.map((revision, index) => (
                                <Link href={`/revision/${revision.id}`} key={revision.id}>
                                    <div 
                                        className="flex items-center justify-between p-4 bg-amber-50/50 rounded-xl hover:bg-amber-50 transition-all duration-200 cursor-pointer border border-amber-100 animate-slide-up"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                                <LucideClock size={18} className="text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-foreground text-sm">
                                                    {revision.codigoActivo}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {isCustodio() ? 'Pendiente tu firma' : `Firma de ${revision.custodioNombre}`}
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm" className="text-amber-700 border-amber-200 hover:bg-amber-100">
                                            {isCustodio() ? 'Firmar' : 'Ver'}
                                        </Button>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <LucideClipboardCheck className="mx-auto mb-3 text-emerald-500" size={40} />
                                <p>¡Todo al día!</p>
                                <p className="text-sm mt-1">No hay pendientes de firma</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
