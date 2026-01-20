'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
    obtenerRevisionesPorRevisor,
    obtenerRevisionesPendientesFirma,
    obtenerTodasLasRevisiones
} from '@/services/revisionService';
import { Revision } from '@/types/revision';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { LucideFileText, LucideClock, LucideCheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function RevisionesPage() {
    const { user, isLogistica, isCustodio, isAdmin } = useAuth();
    const [revisiones, setRevisiones] = useState<Revision[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadRevisiones() {
            if (!user) return;
            try {
                let items: Revision[] = [];
                if (isAdmin() || isLogistica()) {
                    // Admin y Logística ven todas las revisiones
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
        // Handle Firestore Timestamp
        if (typeof date === 'object' && 'seconds' in date) {
            return new Date(date.seconds * 1000).toLocaleDateString('es-CO');
        }
        return new Date(date).toLocaleDateString('es-CO');
    };

    const getEstadoBadge = (estado: string) => {
        switch (estado) {
            case 'borrador':
                return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-[10px] uppercase font-bold">Borrador</span>;
            case 'pendiente_firma_custodio':
                return <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] uppercase font-bold flex items-center gap-1"><LucideClock size={10} /> Pendiente Firma</span>;
            case 'firmada_completa':
                return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] uppercase font-bold flex items-center gap-1"><LucideClock size={10} /> Generando PDF...</span>;
            case 'completada':
                return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] uppercase font-bold flex items-center gap-1"><LucideCheckCircle size={10} /> Completada</span>;
            case 'error_generacion':
                return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] uppercase font-bold">Error al generar</span>;
            default:
                return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] uppercase font-bold text-center">{estado}</span>;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Historial de Revisiones</h2>
                    <p className="text-gray-500">
                        {isCustodio()
                            ? 'Revisiones pendientes de tu firma.'
                            : 'Gestión y seguimiento de actas de activos fijos.'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {revisiones.map((revision) => (
                    <Link key={revision.id} href={`/revision/${revision.id}`}>
                        <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary/20">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-primary border">
                                        <LucideFileText size={24} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-bold text-gray-900">
                                                {revision.numeroActa || `PRE-ACTA (${revision.id.substring(0, 8)})`}
                                            </p>
                                            {getEstadoBadge(revision.estado)}
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">{revision.codigoActivo}</span> - {revision.descripcionActivo}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Fecha: {formatDate(revision.fecha)} | Custodio: {revision.custodioNombre}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden md:block">
                                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Estado Activo</p>
                                        <p className="text-sm font-bold capitalize text-primary">{revision.estadoActivo}</p>
                                    </div>
                                    <Button variant="outline" size="sm">
                                        {isCustodio() && revision.estado === 'pendiente_firma_custodio' ? 'Firmar' : 'Detalle'}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </Link>
                ))}

                {revisiones.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed">
                        <LucideFileText className="mx-auto text-gray-300 mb-4" size={48} />
                        <p className="text-gray-500 font-medium">No se encontraron revisiones.</p>
                        {isLogistica() && (
                            <p className="text-sm text-gray-400 mt-1">Inicie una revisión desde la lista de activos.</p>
                        )}
                        {isCustodio() && (
                            <p className="text-sm text-gray-400 mt-1">No tiene revisiones pendientes de firma.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
