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
import { LucideBox, LucideHistory, LucideArrowLeft, LucideUser, LucideMapPin, LucideFileText, LucideCheckCircle, LucideClock } from 'lucide-react';
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
                return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1"><LucideCheckCircle size={10} /> Completada</span>;
            case 'pendiente_firma_custodio':
                return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1"><LucideClock size={10} /> Pendiente</span>;
            case 'firmada_completa':
                return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1"><LucideClock size={10} /> Procesando</span>;
            default:
                return <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold">{estado}</span>;
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

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Link href="/activos" className="flex items-center gap-2 text-primary hover:underline text-sm font-medium">
                <LucideArrowLeft size={16} />
                Volver al Inventario
            </Link>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{activo.descripcion}</h2>
                    <p className="text-gray-500 font-mono text-sm">{activo.codigo}</p>
                </div>

                <div className="flex gap-2">
                    {(isLogistica() || isAdmin()) && (
                        <Link href={`/revision/nueva/${activo.id}`}>
                            <Button>Realizar Revisión</Button>
                        </Link>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 p-6 space-y-8">
                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                            <LucideBox size={20} className="text-primary" />
                            Detalles del Activo
                        </h3>
                        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Categoría</p>
                                <p className="text-gray-900 font-medium">{activo.categoria}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Estado</p>
                                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase">
                                    {activo.estado}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Marca / Modelo</p>
                                <p className="text-gray-900 font-medium">{activo.marca || 'N/A'} - {activo.modelo || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Serial</p>
                                <p className="text-gray-900 font-medium font-mono">{activo.serial || 'S/N'}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Ubicación / Dependencia</p>
                                <div className="flex items-center gap-2">
                                    <LucideMapPin size={16} className="text-gray-400" />
                                    <p className="text-gray-900 font-medium">{activo.ubicacion} - {activo.dependencia}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                            <LucideHistory size={20} className="text-primary" />
                            Historial de Revisiones
                        </h3>
                        {loadingRevisiones ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg">
                                <Spinner size="sm" />
                                <p className="text-gray-500 text-sm italic mt-2">Cargando historial...</p>
                            </div>
                        ) : revisiones.length > 0 ? (
                            <div className="space-y-3">
                                {revisiones.map((revision) => (
                                    <Link key={revision.id} href={`/revision/${revision.id}`}>
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border">
                                                    <LucideFileText size={18} className="text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900 text-sm">
                                                        {revision.numeroActa || `Borrador (${revision.id.substring(0, 6)})`}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(revision.fecha).toLocaleDateString('es-CO')} - {revision.revisorNombre}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium capitalize text-primary">{revision.estadoActivo}</span>
                                                {getEstadoBadge(revision.estado)}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-gray-50 rounded-lg">
                                <LucideFileText className="mx-auto text-gray-300 mb-2" size={32} />
                                <p className="text-gray-500 text-sm">No hay revisiones registradas para este activo.</p>
                            </div>
                        )}
                    </section>
                </Card>

                <Card className="p-6 h-fit">
                    <h3 className="font-bold text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
                        <LucideUser size={18} className="text-primary" />
                        Custodio Actual
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-bold text-gray-900">{activo.custodioNombre}</p>
                            <p className="text-xs text-gray-500">ID: {activo.custodioId}</p>
                        </div>
                        <div className="pt-4 border-t">
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Registrado el</p>
                            <p className="text-sm text-gray-700">
                                {activo.creadoEn ? new Date(activo.creadoEn).toLocaleDateString('es-CO') : 'Sin fecha'}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
