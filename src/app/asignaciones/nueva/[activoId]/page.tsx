'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { LucideBox, LucideClipboardCheck } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { AsignacionInicialForm } from '@/components/forms/AsignacionInicialForm';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { obtenerAsignacionInicialPorActivo } from '@/services/asignacionService';
import { obtenerActivo } from '@/services/activoService';
import { obtenerUsuario } from '@/services/usuarioService';
import { Activo } from '@/types/activo';
import { AsignacionInicial } from '@/types/asignacion';
import { Usuario } from '@/types/usuario';

export default function NuevaAsignacionInicialPage() {
  const { activoId } = useParams();
  const router = useRouter();
  const { isLogistica, isAdmin } = useAuth();
  const [activo, setActivo] = useState<Activo | null>(null);
  const [custodio, setCustodio] = useState<Usuario | null>(null);
  const [existingAssignment, setExistingAssignment] = useState<AsignacionInicial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!activoId) return;

      try {
        const activoData = await obtenerActivo(activoId as string);
        setActivo(activoData);

        if (activoData?.custodioId) {
          const [custodioData, assignmentData] = await Promise.all([
            obtenerUsuario(activoData.custodioId),
            obtenerAsignacionInicialPorActivo(activoData.id),
          ]);
          setCustodio(custodioData);
          setExistingAssignment(assignmentData);
        }
      } catch (error) {
        console.error('Error loading initial assignment data:', error);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [activoId]);

  const handleSuccess = (assignmentId: string) => {
    router.push(`/asignaciones/${assignmentId}`);
  };

  if (loading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <Spinner size='lg' />
      </div>
    );
  }

  if (!activo) {
    return <div className='py-12 text-center text-red-500'>Activo no encontrado.</div>;
  }

  if (!isLogistica() && !isAdmin()) {
    return <div className='py-12 text-center text-red-500'>No tiene permisos para realizar esta acción.</div>;
  }

  if (!activo.custodioId) {
    return (
      <div className='mx-auto max-w-3xl space-y-6'>
        <PageHeader
          title='Asignación inicial'
          subtitle='El activo todavía no tiene custodio asignado.'
          breadcrumbItems={[
            { label: 'Activos', href: '/activos', icon: <LucideBox size={14} /> },
            { label: activo.codigo, href: `/activos/${activo.id}` },
            { label: 'Asignación inicial', icon: <LucideClipboardCheck size={14} /> },
          ]}
          backHref={`/activos/${activo.id}`}
        />

        <Card className='border-border/50 p-6'>
          <p className='text-sm text-muted-foreground'>
            Debe asignar primero un custodio responsable al activo antes de registrar su acta inicial.
          </p>
        </Card>
      </div>
    );
  }

  if (existingAssignment && existingAssignment.estado !== 'anulada') {
    return (
      <div className='mx-auto max-w-3xl space-y-6'>
        <PageHeader
          title='Asignación inicial existente'
          subtitle='El activo ya tiene una asignación inicial en proceso o completada.'
          breadcrumbItems={[
            { label: 'Activos', href: '/activos', icon: <LucideBox size={14} /> },
            { label: activo.codigo, href: `/activos/${activo.id}` },
            { label: 'Asignación inicial', icon: <LucideClipboardCheck size={14} /> },
          ]}
          backHref={`/activos/${activo.id}`}
        />

        <Card className='space-y-4 border-border/50 p-6'>
          <p className='text-sm text-muted-foreground'>
            Para evitar duplicados, continúe sobre la asignación inicial ya registrada para este activo.
          </p>
          <Link href={`/asignaciones/${existingAssignment.id}`} className='inline-flex'>
            <Card className='border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary'>
              Ver asignación inicial actual
            </Card>
          </Link>
        </Card>
      </div>
    );
  }

  const custodioData = {
    id: activo.custodioId,
    nombre: custodio?.nombre || activo.custodioNombre,
    cedula: custodio?.cedula || 'No especificada',
    cargo: custodio?.cargo || 'Custodio asignado',
  };

  return (
    <div className='mx-auto max-w-4xl space-y-6'>
      <PageHeader
        title='Asignación inicial de activo'
        subtitle={`${activo.codigo} - ${activo.descripcion}`}
        breadcrumbItems={[
          { label: 'Activos', href: '/activos', icon: <LucideBox size={14} /> },
          { label: activo.codigo, href: `/activos/${activo.id}` },
          { label: 'Asignación inicial', icon: <LucideClipboardCheck size={14} /> },
        ]}
        backHref={`/activos/${activo.id}`}
      />

      <Card className='border-border/50 p-6 shadow-elegant md:p-8'>
        <AsignacionInicialForm activo={activo} custodio={custodioData} onSuccess={handleSuccess} />
      </Card>
    </div>
  );
}
