'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  LucideBox,
  LucideClipboardCheck,
  LucideFileText,
  LucideHistory,
  LucideMapPin,
  LucideUser,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { getAssetClassification } from '@/lib/utils/assetClassification';
import { resolveInitialAssignmentStatus } from '@/lib/utils/initialAssignment';
import { getAssetLocation } from '@/lib/utils/assetLocation';
import { obtenerActivo } from '@/services/activoService';
import { obtenerAsignacionInicialPorActivo } from '@/services/asignacionService';
import { obtenerRevisionesPorActivo } from '@/services/revisionService';
import { Activo } from '@/types/activo';
import { AsignacionInicial } from '@/types/asignacion';
import { Revision } from '@/types/revision';

export default function ActivoDetailPage() {
  const { id } = useParams();
  const { isLogistica, isAdmin } = useAuth();
  const [activo, setActivo] = useState<Activo | null>(null);
  const [asignacionInicial, setAsignacionInicial] = useState<AsignacionInicial | null>(null);
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

    void loadData();
  }, [id]);

  useEffect(() => {
    async function loadRelatedData() {
      if (!id) return;

      try {
        const [revisionesData, asignacionData] = await Promise.all([
          obtenerRevisionesPorActivo(id as string),
          obtenerAsignacionInicialPorActivo(id as string),
        ]);
        setRevisiones(revisionesData);
        setAsignacionInicial(asignacionData);
      } catch (error) {
        console.error('Error loading related asset data:', error);
      } finally {
        setLoadingRevisiones(false);
      }
    }

    void loadRelatedData();
  }, [id]);

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'completada':
        return (
          <Badge variant='completed' size='sm' icon={<LucideFileText size={10} />}>
            Completada
          </Badge>
        );
      case 'pendiente_firma_custodio':
        return (
          <Badge variant='pending' size='sm'>
            Pendiente
          </Badge>
        );
      case 'firmada_completa':
        return (
          <Badge variant='info' size='sm'>
            Procesando
          </Badge>
        );
      default:
        return (
          <Badge variant='secondary' size='sm'>
            {estado}
          </Badge>
        );
    }
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

  const assetClassification = getAssetClassification(activo.codigo, activo.categoria);
  const assetLocation = getAssetLocation(activo.ubicacion);
  const initialAssignmentStatus = resolveInitialAssignmentStatus(activo);

  const actions =
    isLogistica() || isAdmin()
      ? !activo.custodioId
        ? []
        : initialAssignmentStatus === 'completada'
        ? [
            {
              label: 'Realizar revisión',
              href: `/revision/nueva/${activo.id}`,
              icon: <LucideClipboardCheck size={18} />,
            },
          ]
        : [
            {
              label: 'Asignación inicial',
              href: `/asignaciones/nueva/${activo.id}`,
              icon: <LucideClipboardCheck size={18} />,
            },
          ]
      : [];

  return (
    <div className='mx-auto max-w-4xl space-y-6'>
      <PageHeader
        title={activo.descripcion}
        subtitle={`Código: ${activo.codigo}`}
        breadcrumbItems={[
          { label: 'Activos', href: '/activos', icon: <LucideBox size={14} /> },
          { label: activo.codigo },
        ]}
        backHref='/activos'
        actions={actions}
      />

      <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
        <Card className='space-y-8 border-border/50 p-6 shadow-elegant md:col-span-2'>
          <section>
            <h3 className='mb-4 flex items-center gap-2 border-b border-border pb-2 text-lg font-bold text-foreground'>
              <LucideBox size={20} className='text-primary' />
              Detalles del activo
            </h3>
            <div className='grid grid-cols-2 gap-x-8 gap-y-6'>
              <div>
                <p className='mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground'>Categoría</p>
                <p className='font-medium text-foreground'>{assetClassification.classificationName}</p>
              </div>
              <div>
                <p className='mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground'>Estado</p>
                <Badge variant={activo.estado === 'activo' ? 'success' : 'error'}>{activo.estado}</Badge>
              </div>
              <div>
                <p className='mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground'>Marca / Modelo</p>
                <p className='font-medium text-foreground'>
                  {activo.marca || 'N/A'} - {activo.modelo || 'N/A'}
                </p>
              </div>
              <div>
                <p className='mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground'>Serial</p>
                <p className='font-mono font-medium text-foreground'>{activo.serial || 'S/N'}</p>
              </div>
              <div className='col-span-2'>
                <p className='mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                  Ubicación / Dependencia
                </p>
                <div className='flex items-center gap-2'>
                  <LucideMapPin size={16} className='text-muted-foreground' />
                  <p className='font-medium text-foreground'>
                    {assetLocation.locationName} - {activo.dependencia}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className='mb-4 flex items-center gap-2 border-b border-border pb-2 text-lg font-bold text-foreground'>
              <LucideHistory size={20} className='text-primary' />
              Historial de revisiones
            </h3>
            {loadingRevisiones ? (
              <div className='rounded-lg border border-border bg-muted py-8 text-center'>
                <Spinner size='sm' />
                <p className='mt-2 text-sm italic text-muted-foreground'>Cargando historial...</p>
              </div>
            ) : revisiones.length > 0 ? (
              <div className='space-y-3'>
                {revisiones.map((revision) => (
                  <Link key={revision.id} href={`/revision/${revision.id}`}>
                    <div className='cursor-pointer rounded-xl border border-border/50 bg-muted/50 p-4 transition-colors hover:bg-muted'>
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                          <div className='flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card shadow-sm'>
                            <LucideFileText size={18} className='text-primary' />
                          </div>
                          <div>
                            <p className='text-sm font-medium text-foreground'>
                              {revision.numeroActa || `Borrador (${revision.id.substring(0, 6)})`}
                            </p>
                            <p className='text-xs text-muted-foreground'>
                              {new Date(revision.fecha).toLocaleDateString('es-CO')} - {revision.revisorNombre}
                            </p>
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
                          <Badge variant='default' size='sm'>
                            {revision.estadoActivo}
                          </Badge>
                          {getEstadoBadge(revision.estado)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className='rounded-lg border border-border bg-muted py-8 text-center'>
                <LucideFileText className='mx-auto mb-2 text-muted-foreground' size={32} />
                <p className='text-sm text-muted-foreground'>No hay revisiones registradas para este activo.</p>
              </div>
            )}
          </section>
        </Card>

        <Card className='h-fit border-border/50 p-6 shadow-elegant'>
          <h3 className='mb-4 flex items-center gap-2 border-b border-border pb-2 font-bold text-foreground'>
            <LucideUser size={18} className='text-primary' />
            Custodio actual
          </h3>
          <div className='space-y-4'>
            <div>
              <p className='text-sm font-bold text-foreground'>{activo.custodioNombre || 'Sin asignar'}</p>
              <p className='text-xs text-muted-foreground'>ID: {activo.custodioId || 'Sin custodio'}</p>
            </div>

            <div className='border-t pt-4'>
              <p className='mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground'>Registrado el</p>
              <p className='text-sm text-foreground'>
                {activo.creadoEn ? new Date(activo.creadoEn).toLocaleDateString('es-CO') : 'Sin fecha'}
              </p>
            </div>

            <div className='border-t pt-4'>
              <p className='mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground'>Asignación inicial</p>
              <Badge
                variant={
                  initialAssignmentStatus === 'completada'
                    ? 'completed'
                    : initialAssignmentStatus === 'pendiente'
                    ? 'pending'
                    : 'secondary'
                }
              >
                {initialAssignmentStatus === 'completada'
                  ? 'Completada'
                  : initialAssignmentStatus === 'pendiente'
                  ? 'Pendiente'
                  : 'No requerida'}
              </Badge>
              <div className='mt-3'>
                {!activo.custodioId ? (
                  <p className='text-xs text-muted-foreground'>
                    Debe asignarse un custodio antes de generar el acta inicial.
                  </p>
                ) : asignacionInicial ? (
                  <Button asChild variant='outline' size='sm'>
                    <Link href={`/asignaciones/${asignacionInicial.id}`}>Ver acta inicial</Link>
                  </Button>
                ) : initialAssignmentStatus !== 'completada' ? (
                  <Button asChild variant='outline' size='sm'>
                    <Link href={`/asignaciones/nueva/${activo.id}`}>Completar asignación inicial</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
