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
import { PageHeader } from '@/components/layout/PageHeader';
import { LucideBox, LucideClipboardCheck } from 'lucide-react';

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

    if (!isLogistica() && !isAdmin()) {
        return (
            <div className="text-center py-12">
                <p className="text-red-500">No tiene permisos para realizar esta acción.</p>
            </div>
        );
    }

    const custodioData = {
        id: activo.custodioId,
        nombre: custodio?.nombre || activo.custodioNombre,
        cedula: custodio?.cedula || 'No especificada',
        cargo: custodio?.cargo || 'Custodio asignado'
    };

    const breadcrumbItems = [
        { label: 'Activos', href: '/activos', icon: <LucideBox size={14} /> },
        { label: activo.codigo, href: `/activos/${activo.id}` },
        { label: 'Nueva Revisión', icon: <LucideClipboardCheck size={14} /> },
    ];

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <PageHeader
                title="Nueva Revisión de Activo"
                subtitle={`${activo.codigo} - ${activo.descripcion}`}
                breadcrumbItems={breadcrumbItems}
                backHref={`/activos/${activo.id}`}
            />

            <Card className="p-6 md:p-8 shadow-elegant border-border/50">
                <RevisionForm
                    activo={activo}
                    custodio={custodioData}
                    onSuccess={handleSuccess}
                />
            </Card>
        </div>
    );
}
