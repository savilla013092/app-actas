'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { LucideCheckCircle2, LucideFileSignature } from 'lucide-react';

import { ActaFormalSignatureCapture } from '@/components/actas-formales/ActaFormalSignatureCapture';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { obtenerFirmantePublico, registrarFirmaPublica } from '@/services/actaFormalService';
import { FirmanteActaFormal, MetodoFirmaActaFormal } from '@/types/actaFormal';

interface FirmarActaPageProps {
  params: {
    actaId: string;
    token: string;
  };
}

export default function FirmarActaPage({ params }: FirmarActaPageProps) {
  const [firmante, setFirmante] = useState<FirmanteActaFormal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    obtenerFirmantePublico(params.actaId, params.token)
      .then((data) => {
        if (mounted) setFirmante(data);
      })
      .catch((error) => {
        console.error('No fue posible cargar el firmante.', error);
        toast({
          title: 'Enlace no disponible',
          description: 'No fue posible cargar la solicitud de firma.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [params.actaId, params.token]);

  const handleSave = async (payload: {
    metodoFirma: MetodoFirmaActaFormal;
    firmaDataUrl?: string;
    claveFirma?: string;
    declaracionAceptada: boolean;
  }) => {
    setSaving(true);
    try {
      await registrarFirmaPublica(params.actaId, params.token, payload);
      setFirmante((current) =>
        current
          ? {
              ...current,
              estado: 'firmada',
              metodoFirma: payload.metodoFirma,
              firmaDataUrl: payload.firmaDataUrl,
              claveFirma: payload.claveFirma,
              declaracionAceptada: payload.declaracionAceptada,
              fechaFirma: new Date(),
            }
          : current
      );
      toast({ title: 'Firma registrada', description: 'Gracias. Su firma quedo asociada al acta.' });
    } catch (error) {
      console.error('No fue posible registrar la firma.', error);
      toast({
        title: 'No fue posible firmar',
        description: 'Revise la conexion e intente nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className='flex min-h-screen items-center justify-center bg-background p-6'>
        <Spinner size='lg' />
      </main>
    );
  }

  if (!firmante) {
    return (
      <main className='flex min-h-screen items-center justify-center bg-background p-6'>
        <Card className='w-full max-w-md rounded-lg p-6 text-center'>
          <LucideFileSignature className='mx-auto mb-3 h-10 w-10 text-muted-foreground' />
          <h1 className='text-xl font-bold text-foreground'>Enlace no encontrado</h1>
          <p className='mt-2 text-sm text-muted-foreground'>
            Solicite al responsable del acta un enlace de firma vigente.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className='min-h-screen bg-background px-4 py-5 text-foreground'>
      <div className='mx-auto flex w-full max-w-lg flex-col gap-4'>
        <div className='flex items-center gap-3'>
          <div className='relative h-12 w-12 overflow-hidden rounded-lg border border-border bg-card'>
            <Image src='/logo-serviciudad.png' alt='SERVICIUDAD ESP' fill className='object-cover' />
          </div>
          <div>
            <p className='text-xs font-bold uppercase tracking-wider text-muted-foreground'>SERVICIUDAD ESP</p>
            <h1 className='text-lg font-bold leading-tight'>Firma de acta formal</h1>
          </div>
        </div>

        <Card className='rounded-lg border-border/70 p-4 shadow-elegant'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <p className='text-sm font-semibold text-foreground'>{firmante.tituloActa || 'Acta formal'}</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {firmante.tipoReunion || 'Reunion'} {firmante.fechaActa ? `- ${firmante.fechaActa}` : ''}
              </p>
            </div>
            <Badge variant={firmante.estado === 'firmada' ? 'success' : 'pending'}>
              {firmante.estado === 'firmada' ? 'Firmada' : 'Pendiente'}
            </Badge>
          </div>
        </Card>

        {firmante.estado === 'firmada' ? (
          <Card className='rounded-lg border-emerald-200 bg-emerald-50 p-6 text-center shadow-elegant'>
            <LucideCheckCircle2 className='mx-auto mb-3 h-12 w-12 text-emerald-600' />
            <h2 className='text-lg font-bold text-emerald-900'>Firma registrada</h2>
            <p className='mt-2 text-sm text-emerald-800'>
              El responsable del acta vera el estado actualizado en tiempo real.
            </p>
          </Card>
        ) : (
          <ActaFormalSignatureCapture
            signerName={firmante.nombre}
            signerRole={firmante.cargo}
            saving={saving}
            onSave={handleSave}
          />
        )}
      </div>
    </main>
  );
}
