'use client';

import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  LucideBox,
  LucideCheckCircle,
  LucideClock,
  LucideDownload,
  LucideFileText,
  LucideImageOff,
  LucideMapPin,
  LucidePenTool,
  LucideUser,
} from 'lucide-react';

import { PageHeader, type ActionButton } from '@/components/layout/PageHeader';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/config';
import { firmarComoCustodio, obtenerRevision } from '@/services/revisionService';
import {
  getOperationalSessionErrorDescription,
  refreshSessionClaims,
} from '@/services/sessionService';
import { Revision } from '@/types/revision';

export default function RevisionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, isAdmin, isCustodio, isLogistica } = useAuth();
  const [revision, setRevision] = useState<Revision | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) {
        return;
      }

      try {
        const data = await obtenerRevision(id as string);
        setRevision(data);
      } catch (error) {
        console.error('Error loading revision:', error);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [id]);

  useEffect(() => {
    if (!revision || revision.estado !== 'pendiente_firma_custodio' || user?.accessStatus !== 'ready') {
      return;
    }

    void refreshSessionClaims().catch((error) => {
      console.warn('No fue posible refrescar la sesion operativa antes de la firma del custodio.', {
        revisionId: revision.id,
        error,
      });
    });
  }, [revision, user?.accessStatus]);

  const handleFirmaCustodio = async (
    firmaDataUrl: string,
    datosFirmante?: { nombre: string; cedula: string }
  ) => {
    if (!revision) {
      return;
    }

    setSigning(true);
    try {
      await firmarComoCustodio(revision.id, firmaDataUrl, revision, datosFirmante);
      const updated = await obtenerRevision(revision.id);
      setRevision(updated);
      setShowSignaturePad(false);
      toast({ title: 'Firma registrada', description: 'La firma del custodio quedó registrada correctamente.' });
    } catch (error) {
      console.error('Error signing revision:', error);
      toast({
        title: 'No fue posible registrar la firma',
        description:
          getOperationalSessionErrorDescription(error) ??
          'Verifique que la revisión siga pendiente y que su perfil corresponda al custodio titular.',
        variant: 'destructive',
      });
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <Spinner size='lg' />
      </div>
    );
  }

  if (!revision) {
    return <div className='py-12 text-center text-red-500'>Revisión no encontrada.</div>;
  }

  const canSign =
    revision.estado === 'pendiente_firma_custodio' && isCustodio() && revision.custodioId === user?.uid;
  const canEditDraft = revision.estado === 'borrador' && (isAdmin() || isLogistica());
  const needsCustodianHandoff = revision.estado === 'pendiente_firma_custodio' && !canSign;
  const isWrongCustodian =
    revision.estado === 'pendiente_firma_custodio' && isCustodio() && revision.custodioId !== user?.uid;
  const nextLoginTarget = `/auth/login?next=${encodeURIComponent(`/revision/${revision.id}`)}`;

  const breadcrumbItems = [
    { label: 'Revisiones', href: '/revision', icon: <LucideFileText size={14} /> },
    { label: revision.numeroActa || 'Revisión' },
  ];

  const actions: ActionButton[] = [];

  if (canEditDraft) {
    actions.push({
      label: 'Editar borrador',
      href: `/revision/${revision.id}/editar`,
      icon: <LucidePenTool size={18} />,
      variant: 'outline',
    });
  }

  if (revision.actaPdfUrl) {
    actions.push({
      label: 'Descargar PDF',
      onClick: () => window.open(revision.actaPdfUrl, '_blank'),
      icon: <LucideDownload size={18} />,
      variant: 'default',
    });
  }

  if (canSign) {
    actions.push({
      label: 'Firmar acta',
      onClick: () => setShowSignaturePad(true),
      icon: <LucidePenTool size={18} />,
      variant: 'warning',
    });
  }

  if (needsCustodianHandoff) {
    actions.push({
      label: 'Cambiar de usuario',
      onClick: () => void handleSwitchToCustodian(),
      icon: <LucideUser size={18} />,
      variant: 'outline',
    });
  }

  const getEstadoBadgeVariant = () => {
    switch (revision.estado) {
      case 'completada':
        return 'completed';
      case 'pendiente_firma_custodio':
        return 'pending';
      case 'firmada_completa':
        return 'info';
      case 'borrador':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleSwitchToCustodian = async () => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('postLoginRedirect', `/revision/${revision.id}`);
      }

      await signOut(auth);
      router.push(nextLoginTarget);
    } catch (error) {
      console.error('Error switching to custodian session:', error);
      toast({
        title: 'No fue posible cambiar de usuario',
        description: 'Cierre sesion e intente nuevamente para continuar con la firma del custodio.',
        variant: 'destructive',
      });
    }
  };

  const renderCustodianMessage = () => {
    if (canSign) {
      return {
        title: 'Revision lista para su firma',
        description:
          'La firma del revisor ya fue registrada. Puede continuar como custodio titular desde esta misma pantalla.',
      };
    }

    if (isWrongCustodian) {
      return {
        title: 'Firma restringida a otro custodio',
        description: `Esta revision solo puede ser firmada por ${revision.custodioNombre}. Su sesion no corresponde al custodio titular asignado.`,
      };
    }

    if (isAdmin() || isLogistica()) {
      return {
        title: 'Pendiente firma del custodio',
        description: `La firma del revisor ya quedo registrada. Para completar el acta, cierre esta sesion e ingrese con ${revision.custodioNombre}.`,
      };
    }

    return {
      title: 'Cambio de usuario requerido',
      description: `Esta revision esta reservada para la firma de ${revision.custodioNombre}. Ingrese con esa cuenta para continuar.`,
    };
  };

  const custodianMessage =
    revision.estado === 'pendiente_firma_custodio' ? renderCustodianMessage() : null;

  return (
    <div className='mx-auto max-w-4xl space-y-8'>
      <PageHeader
        title={revision.numeroActa || 'Revisión en proceso'}
        subtitle={`ID: ${revision.id.substring(0, 8).toUpperCase()}`}
        breadcrumbItems={breadcrumbItems}
        backHref='/revision'
        actions={actions}
      />

      <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
        <Card className='space-y-8 border-border/50 p-6 shadow-elegant md:col-span-2'>
          <section>
            <h3 className='mb-4 flex items-center gap-2 border-b border-border pb-2 text-lg font-bold text-foreground'>
              <LucideBox size={20} className='text-primary' />
              Información del activo
            </h3>
            <div className='grid grid-cols-2 gap-x-8 gap-y-4'>
              <div>
                <p className='text-xs font-bold uppercase tracking-wider text-muted-foreground'>Código</p>
                <p className='font-medium text-foreground'>{revision.codigoActivo}</p>
              </div>
              <div>
                <p className='text-xs font-bold uppercase tracking-wider text-muted-foreground'>Ubicación</p>
                <div className='flex items-center gap-1'>
                  <LucideMapPin size={14} className='text-muted-foreground' />
                  <p className='font-medium text-foreground'>{revision.ubicacionActivo}</p>
                </div>
              </div>
              <div className='col-span-2'>
                <p className='text-xs font-bold uppercase tracking-wider text-muted-foreground'>Descripción</p>
                <p className='font-medium text-foreground'>{revision.descripcionActivo}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className='mb-4 flex items-center gap-2 border-b border-border pb-2 text-lg font-bold text-foreground'>
              <LucideFileText size={20} className='text-primary' />
              Resultado de la revisión
            </h3>
            <div className='space-y-4'>
              <div className='flex items-center gap-4'>
                <p className='shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                  Estado del activo:
                </p>
                <Badge
                  variant={
                    revision.estadoActivo === 'excelente' || revision.estadoActivo === 'bueno'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {revision.estadoActivo}
                </Badge>
              </div>
              <div>
                <p className='mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                  Descripción de hallazgos
                </p>
                <div className='rounded-xl border border-border/50 bg-muted/50 p-4 text-sm italic leading-relaxed text-foreground'>
                  &ldquo;{revision.descripcion}&rdquo;
                </div>
              </div>
              {revision.observaciones ? (
                <div>
                  <p className='mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground'>
                    Observaciones
                  </p>
                  <p className='text-sm text-muted-foreground'>{revision.observaciones}</p>
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className='mb-4 border-b border-border pb-2 text-lg font-bold text-foreground'>
              Registro fotográfico
            </h3>
            <div className='grid grid-cols-2 gap-4 sm:grid-cols-3'>
              {revision.evidencias.map((evidencia) => (
                <div
                  key={evidencia.id}
                  className='relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted shadow-elegant'
                >
                  {evidencia.url ? (
                    <Image
                      src={evidencia.url}
                      alt={evidencia.nombre}
                      fill
                      className='object-cover'
                      unoptimized
                    />
                  ) : (
                    <div className='flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground'>
                      <LucideImageOff size={24} />
                      <span className='px-3 text-center text-xs'>Vista previa no disponible</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </Card>

        <div className='space-y-6'>
          <Card className='border-border/50 p-6 shadow-elegant'>
            <h3 className='mb-4 flex items-center gap-2 border-b border-border pb-2 font-bold text-foreground'>
              <LucideUser size={18} className='text-primary' />
              Firmas y estados
            </h3>

            <div className='space-y-6'>
              <div>
                <p className='mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>
                  Estado del proceso
                </p>
                <div className='flex items-center gap-2'>
                  {revision.estado === 'completada' ? (
                    <LucideCheckCircle className='text-green-500' size={20} />
                  ) : (
                    <LucideClock className='animate-pulse text-orange-500' size={20} />
                  )}
                  <Badge variant={getEstadoBadgeVariant()}>{revision.estado.replace(/_/g, ' ')}</Badge>
                </div>
              </div>

              <div className='border-t pt-4'>
                <p className='mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>
                  Profesional revisor
                </p>
                <p className='text-sm font-bold text-foreground'>{revision.revisorNombre}</p>
                <p className='text-xs text-muted-foreground'>Logística</p>
                {revision.firmaRevisor ? (
                  <div className='mt-2 flex items-center gap-2 text-green-600'>
                    <LucideCheckCircle size={14} />
                    <span className='text-[10px] font-bold uppercase'>Firmado</span>
                  </div>
                ) : (
                  <Badge variant='error' size='sm' className='mt-2'>
                    Pendiente
                  </Badge>
                )}
              </div>

              <div className='border-t pt-4'>
                <p className='mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>
                  Custodio responsable
                </p>
                <p className='text-sm font-bold text-foreground'>{revision.custodioNombre}</p>
                <p className='text-xs text-muted-foreground'>Dependencia: {revision.ubicacionActivo}</p>
                {revision.firmaCustodio ? (
                  <div className='mt-2 flex items-center gap-2 text-green-600'>
                    <LucideCheckCircle size={14} />
                    <span className='text-[10px] font-bold uppercase'>Firmado</span>
                  </div>
                ) : (
                  <Badge variant='pending' size='sm' className='mt-2'>
                    Esperando firma
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {canEditDraft ? (
            <Card className='border-border/50 p-6 shadow-elegant'>
              <p className='text-sm text-muted-foreground'>
                Este borrador todavía puede editarse. Puede corregir fecha, custodio, descripción,
                observaciones y evidencias hasta que el revisor registre su firma.
              </p>
            </Card>
          ) : null}

          {custodianMessage ? (
            <Card className='space-y-4 border-border/50 p-6 shadow-elegant'>
              <div>
                <h3 className='text-base font-semibold text-foreground'>{custodianMessage.title}</h3>
                <p className='mt-2 text-sm text-muted-foreground'>{custodianMessage.description}</p>
              </div>

              <div className='rounded-lg border border-border/50 bg-muted/50 p-4 text-sm text-foreground'>
                <p>
                  <strong>Custodio titular:</strong> {revision.custodioNombre}
                </p>
                <p>
                  <strong>Cedula registrada:</strong> {revision.custodioCedula}
                </p>
              </div>

              {canSign ? (
                <Button onClick={() => setShowSignaturePad(true)} variant='warning' className='w-full'>
                  Firmar acta como custodio
                </Button>
              ) : (
                <Button
                  onClick={() => void handleSwitchToCustodian()}
                  variant='outline'
                  className='w-full'
                >
                  Cerrar sesion y continuar con custodio
                </Button>
              )}
            </Card>
          ) : null}
        </div>
      </div>

      {showSignaturePad ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm'>
          <div className='w-full max-w-xl animate-scale-in'>
            <SignaturePad
              titulo='Firma del custodio del activo'
              nombreFirmante={revision.custodioNombre || user?.usuario?.nombre || ''}
              cedulaFirmante={revision.custodioCedula || user?.usuario?.cedula || ''}
              declaracion='Certifico que la información registrada en esta revisión es veraz y acepto mi responsabilidad sobre el activo descrito en el estado manifestado.'
              onSave={handleFirmaCustodio}
              onCancel={() => setShowSignaturePad(false)}
              permitirEdicion
            />
            {signing ? <p className='mt-3 text-center text-sm text-white'>Registrando firma...</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
