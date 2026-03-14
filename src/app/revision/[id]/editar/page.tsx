'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LucideBox, LucideClipboardCheck, LucideFileText } from 'lucide-react';

import { RevisionForm } from '@/components/forms/RevisionForm';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { obtenerActivo } from '@/services/activoService';
import { obtenerRevision } from '@/services/revisionService';
import { obtenerTodosLosUsuarios } from '@/services/usuarioService';
import { Activo } from '@/types/activo';
import { Revision } from '@/types/revision';
import { Usuario } from '@/types/usuario';

export default function EditarRevisionPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAdmin, isLogistica } = useAuth();
  const [revision, setRevision] = useState<Revision | null>(null);
  const [activo, setActivo] = useState<Activo | null>(null);
  const [custodios, setCustodios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id) {
        return;
      }

      try {
        const revisionData = await obtenerRevision(id as string);
        setRevision(revisionData);

        if (!revisionData) {
          return;
        }

        const [activoData, usuarios] = await Promise.all([
          obtenerActivo(revisionData.activoId),
          obtenerTodosLosUsuarios(),
        ]);

        setActivo(activoData);
        setCustodios(usuarios.filter((usuario) => usuario.rol === 'custodio' && usuario.activo));
      } catch (error) {
        console.error('Error loading revision draft editor:', error);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [id]);

  const handleSuccess = (revisionId: string) => {
    router.push(`/revision/${revisionId}`);
  };

  if (loading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <Spinner size='lg' />
      </div>
    );
  }

  if (!isAdmin() && !isLogistica()) {
    return <div className='py-12 text-center text-red-500'>No tiene permisos para editar revisiones.</div>;
  }

  if (!revision) {
    return <div className='py-12 text-center text-red-500'>Revisión no encontrada.</div>;
  }

  if (!activo) {
    return <div className='py-12 text-center text-red-500'>Activo asociado no encontrado.</div>;
  }

  if (revision.estado !== 'borrador') {
    return (
      <div className='mx-auto max-w-3xl space-y-6'>
        <PageHeader
          title='Borrador bloqueado'
          subtitle='La revisión ya fue firmada por el revisor y no admite más edición.'
          breadcrumbItems={[
            { label: 'Revisiones', href: '/revision', icon: <LucideFileText size={14} /> },
            { label: revision.numeroActa || 'Revisión', href: `/revision/${revision.id}` },
            { label: 'Editar borrador' },
          ]}
          backHref={`/revision/${revision.id}`}
        />

        <Card className='space-y-4 border-border/50 p-6 shadow-elegant'>
          <p className='text-sm text-muted-foreground'>
            El borrador solo puede editarse mientras permanezca en estado <strong>borrador</strong>.
            Esta revisión ya pasó a <strong>{revision.estado.replace(/_/g, ' ')}</strong>.
          </p>
          <div>
            <Button asChild variant='outline'>
              <Link href={`/revision/${revision.id}`}>Volver al detalle de la revisión</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-4xl space-y-6'>
      <PageHeader
        title='Editar borrador de revisión'
        subtitle={`${activo.codigo} - ${activo.descripcion}`}
        breadcrumbItems={[
          { label: 'Revisiones', href: '/revision', icon: <LucideFileText size={14} /> },
          { label: revision.numeroActa || 'Borrador', href: `/revision/${revision.id}` },
          { label: 'Editar borrador', icon: <LucideClipboardCheck size={14} /> },
        ]}
        backHref={`/revision/${revision.id}`}
      />

      <Card className='p-6 shadow-elegant border-border/50'>
        <RevisionForm
          activo={activo}
          custodio={{
            id: revision.custodioId,
            nombre: revision.custodioNombre,
            cedula: revision.custodioCedula,
            cargo: revision.custodioCargo,
          }}
          revision={revision}
          custodios={custodios}
          onSuccess={handleSuccess}
        />
      </Card>
    </div>
  );
}
