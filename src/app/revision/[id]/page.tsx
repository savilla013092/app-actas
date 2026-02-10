'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { obtenerRevision, firmarComoCustodio } from '@/services/revisionService';
import { Revision } from '@/types/revision';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SignaturePad } from '@/components/signature/SignaturePad';
import {
    LucideFileText,
    LucideDownload,
    LucideClock,
    LucideCheckCircle,
    LucideUser,
    LucideBox,
    LucideMapPin,
    LucideArrowLeft,
    LucideHome
} from 'lucide-react';
import Link from 'next/link';

export default function RevisionDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, isCustodio, isAdmin } = useAuth();
    const [revision, setRevision] = useState<Revision | null>(null);
    const [loading, setLoading] = useState(true);
    const [signing, setSigning] = useState(false);
    const [showSignaturePad, setShowSignaturePad] = useState(false);

    useEffect(() => {
        async function loadData() {
            if (!id) return;
            try {
                const data = await obtenerRevision(id as string);
                setRevision(data);
            } catch (error) {
                console.error('Error loading revision:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

    const handleFirmaCustodio = async (firmaDataUrl: string, datosFirmante?: { nombre: string; cedula: string }) => {
        if (!revision) return;
        setSigning(true);
        try {
            await firmarComoCustodio(revision.id, firmaDataUrl, revision, datosFirmante);
            // Reload page data
            const updated = await obtenerRevision(revision.id);
            setRevision(updated);
            setShowSignaturePad(false);
        } catch (error) {
            console.error('Error signing:', error);
            alert('Error al registrar la firma');
        } finally {
            setSigning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!revision) {
        return <div className="text-center py-12 text-red-500">Revisión no encontrada.</div>;
    }

    // Permitir firmar si:
    // 1. Es custodio y el activo está asignado a él, O
    // 2. Es admin (para pruebas y gestión)
    const canSign = revision.estado === 'pendiente_firma_custodio' && (
        (isCustodio() && revision.custodioId === user?.uid) ||
        isAdmin()
    );

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.back()}
                    className="flex items-center gap-2"
                >
                    <LucideArrowLeft size={16} />
                    Atrás
                </Button>
                <Link href="/dashboard">
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <LucideHome size={16} />
                        Inicio
                    </Button>
                </Link>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-bold text-foreground">
                            {revision.numeroActa || 'Revisión en Proceso'}
                        </h2>
                    </div>
                    <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">{revision.id}</p>
                </div>

                <div className="flex gap-2">
                    {revision.actaPdfUrl && (
                        <Button className="flex items-center gap-2" onClick={() => window.open(revision.actaPdfUrl, '_blank')}>
                            <LucideDownload size={18} />
                            Descargar Acta PDF
                        </Button>
                    )}
                    {canSign && (
                        <Button onClick={() => setShowSignaturePad(true)} className="bg-orange-600 hover:bg-orange-700">
                            Firmar Acta
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 p-6 space-y-8">
                    {/* Información del Activo */}
                    <section>
                        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2 border-b border-border pb-2">
                            <LucideBox size={20} className="text-primary" />
                            Información del Activo
                        </h3>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Código</p>
                                <p className="text-foreground font-medium">{revision.codigoActivo}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Ubicación</p>
                                <div className="flex items-center gap-1">
                                    <LucideMapPin size={14} className="text-muted-foreground" />
                                    <p className="text-foreground font-medium">{revision.ubicacionActivo}</p>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Descripción</p>
                                <p className="text-foreground font-medium">{revision.descripcionActivo}</p>
                            </div>
                        </div>
                    </section>

                    {/* Resultado de la Revisión */}
                    <section>
                        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2 border-b border-border pb-2">
                            <LucideFileText size={20} className="text-primary" />
                            Resultado de la Revisión
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider shrink-0">Estado del Activo:</p>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${revision.estadoActivo === 'excelente' || revision.estadoActivo === 'bueno'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                    {revision.estadoActivo}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Descripción de hallazgos</p>
                                <div className="bg-muted p-4 rounded-lg text-foreground text-sm italic leading-relaxed border border-border">
                                    &ldquo;{revision.descripcion}&rdquo;
                                </div>
                            </div>
                            {revision.observaciones && (
                                <div>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-1">Observaciones</p>
                                    <p className="text-sm text-muted-foreground">{revision.observaciones}</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Evidencias */}
                    <section>
                        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2 border-b border-border pb-2">
                            Registro Fotográfico
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {revision.evidencias.map((ev, idx) => (
                                <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                                    <img src={ev.url} alt={ev.nombre} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                                </div>
                            ))}
                        </div>
                    </section>
                </Card>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <Card className="p-6">
                        <h3 className="font-bold text-foreground mb-4 border-b border-border pb-2 flex items-center gap-2">
                            <LucideUser size={18} className="text-primary" />
                            Firmas y Estados
                        </h3>

                        <div className="space-y-6">
                            {/* Proceso */}
                            <div>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">Estado del Proceso</p>
                                <div className="flex items-center gap-2">
                                    {revision.estado === 'completada' ? (
                                        <LucideCheckCircle className="text-green-500" size={20} />
                                    ) : (
                                        <LucideClock className="text-orange-500 animate-pulse" size={20} />
                                    )}
                                    <span className="font-bold text-sm capitalize">{revision.estado.replace(/_/g, ' ')}</span>
                                </div>
                            </div>

                            {/* Revisor */}
                            <div className="pt-4 border-t">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">Profesional Revisor</p>
                                <p className="text-sm font-bold text-foreground">{revision.revisorNombre}</p>
                                <p className="text-xs text-muted-foreground">Logística</p>
                                {revision.firmaRevisor ? (
                                    <div className="mt-2 flex items-center gap-2 text-green-600">
                                        <LucideCheckCircle size={14} />
                                        <span className="text-[10px] font-bold uppercase">Firmado</span>
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-red-500 font-bold uppercase mt-1 block">Pendiente</span>
                                )}
                            </div>

                            {/* Custodio */}
                            <div className="pt-4 border-t">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">Custodio Responsable</p>
                                <p className="text-sm font-bold text-foreground">{revision.custodioNombre}</p>
                                <p className="text-xs text-muted-foreground">Dependencia: {revision.ubicacionActivo}</p>
                                {revision.firmaCustodio ? (
                                    <div className="mt-2 flex items-center gap-2 text-green-600">
                                        <LucideCheckCircle size={14} />
                                        <span className="text-[10px] font-bold uppercase">Firmado</span>
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-orange-500 font-bold uppercase mt-1 block">Esperando Firma</span>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Signature Modal Override */}
            {showSignaturePad && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-xl">
                        <SignaturePad
                            titulo="Firma del Custodio del Activo"
                            nombreFirmante={revision.custodioNombre || user?.usuario?.nombre || ''}
                            cedulaFirmante={revision.custodioCedula || user?.usuario?.cedula || ''}
                            declaracion="Certifico que la información registrada en esta revisión es veraz y acepto mi responsabilidad sobre el activo descrito en el estado manifestado."
                            onSave={handleFirmaCustodio}
                            onCancel={() => setShowSignaturePad(false)}
                            permitirEdicion={true}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
