'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { obtenerActivo } from '@/services/activoService';
import { obtenerUsuario } from '@/services/usuarioService';
import { Activo } from '@/types/activo';
import { Usuario } from '@/types/usuario';
import { RevisionForm } from '@/components/forms/RevisionForm';
import { Spinner } from '@/components/ui/spinner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideArrowLeft, LucideHome } from 'lucide-react';
import Link from 'next/link';

export default function NuevaRevisionPage() {
    const { activoId } = useParams();
    const router = useRouter();
    const { user, isLogistica, isAdmin } = useAuth();
    const [activo, setActivo] = useState<Activo | null>(null);
    const [custodio, setCustodio] = useState<Usuario | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            if (!activoId) return;
            try {
                const activoData = await obtenerActivo(activoId as string);
                setActivo(activoData);

                // Cargar datos completos del custodio
                if (activoData?.custodioId) {
                    const custodioData = await obtenerUsuario(activoData.custodioId);
                    setCustodio(custodioData);
                }
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [activoId]);

    const handleSuccess = (revisionId: string) => {
        router.push(`/revision/${revisionId}`);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!activo) {
        return (
            <div className="text-center py-12">
                <p className="text-red-500">Activo no encontrado.</p>
            </div>
        );
    }

    // Solo logística o admin pueden crear revisiones
    if (!isLogistica() && !isAdmin()) {
        return (
            <div className="text-center py-12">
                <p className="text-red-500">No tiene permisos para realizar esta acción.</p>
            </div>
        );
    }

    // Preparar datos del custodio
    const custodioData = {
        id: activo.custodioId,
        nombre: custodio?.nombre || activo.custodioNombre,
        cedula: custodio?.cedula || 'No especificada',
        cargo: custodio?.cargo || 'Custodio asignado'
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
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

            <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground">Nueva Revisión de Activo</h2>
                <p className="text-muted-foreground">Complete los pasos para registrar el estado actual del activo.</p>
            </div>

            <Card className="p-8">
                <RevisionForm
                    activo={activo}
                    custodio={custodioData}
                    onSuccess={handleSuccess}
                />
            </Card>
        </div>
    );
}
