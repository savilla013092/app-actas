'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { EvidenciasUploader } from '@/components/revision/EvidenciasUploader';
import { SignaturePad } from '@/components/signature/SignaturePad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { getAssetLocation } from '@/lib/utils/assetLocation';
import { crearRevision, firmarComoRevisor, subirEvidencia } from '@/services/revisionService';
import { Activo } from '@/types/activo';

const revisionSchema = z.object({
  fecha: z.string().min(1, 'La fecha es requerida'),
  estadoActivo: z.enum(['excelente', 'bueno', 'regular', 'malo', 'para_baja']),
  descripcion: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  observaciones: z.string().optional(),
});

type RevisionFormData = z.infer<typeof revisionSchema>;

interface RevisionFormProps {
  activo: Activo;
  custodio: {
    id: string;
    nombre: string;
    cedula: string;
    cargo: string;
  };
  onSuccess: (revisionId: string) => void;
}

export function RevisionForm({ activo, custodio, onSuccess }: RevisionFormProps) {
  const { user } = useAuth();
  const [paso, setPaso] = useState<'formulario' | 'evidencias' | 'firma'>('formulario');
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [evidencias, setEvidencias] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const assetLocation = getAssetLocation(activo.ubicacion);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<RevisionFormData>({
    resolver: zodResolver(revisionSchema),
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0],
      estadoActivo: 'bueno',
    },
  });

  const onSubmitFormulario = async (data: RevisionFormData) => {
    if (!user?.usuario) {
      toast({
        title: 'Perfil no disponible',
        description: 'Debe iniciar sesión con un perfil operativo válido para crear revisiones.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const id = await crearRevision({
        activoId: activo.id,
        codigoActivo: activo.codigo,
        descripcionActivo: activo.descripcion,
        ubicacionActivo: assetLocation.locationName,
        custodioId: custodio.id,
        custodioNombre: custodio.nombre,
        custodioCedula: custodio.cedula,
        custodioCargo: custodio.cargo,
        revisorId: user.uid,
        revisorNombre: user.usuario.nombre,
        revisorCedula: user.usuario.cedula,
        revisorCargo: user.usuario.cargo,
        fecha: new Date(data.fecha),
        estadoActivo: data.estadoActivo,
        descripcion: data.descripcion,
        observaciones: data.observaciones,
        estado: 'borrador',
        creadoPor: user.uid,
      });

      setRevisionId(id);
      setPaso('evidencias');
    } catch (error) {
      console.error('Error creating revision:', error);
      toast({
        title: 'No fue posible crear la revisión',
        description: 'Revise sus permisos e intente nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubirEvidencias = async () => {
    if (!revisionId) {
      return;
    }

    setLoading(true);

    try {
      for (let index = 0; index < evidencias.length; index += 1) {
        await subirEvidencia(
          revisionId,
          evidencias[index],
          `Evidencia ${index + 1}`,
          `Fotografía de revisión ${index + 1}`
        );
      }
      setPaso('firma');
    } catch (error) {
      console.error('Error uploading evidences:', error);
      toast({
        title: 'Error al subir evidencias',
        description: 'No fue posible registrar el material fotográfico de la revisión.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFirmaRevisor = async (firmaDataUrl: string) => {
    if (!revisionId) {
      return;
    }

    setLoading(true);

    try {
      const datosRevision = {
        ...getValues(),
        activo,
        custodio,
        revisor: user?.usuario,
        fecha: new Date().toISOString(),
      };

      await firmarComoRevisor(revisionId, firmaDataUrl, datosRevision);
      onSuccess(revisionId);
    } catch (error) {
      console.error('Error registering reviewer signature:', error);
      toast({
        title: 'No fue posible registrar la firma',
        description: 'La revisión quedó guardada, pero la firma del revisor no se pudo procesar.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mx-auto max-w-2xl'>
      <div className='mb-8 flex justify-between'>
        {['Datos', 'Evidencias', 'Firma'].map((label, index) => {
          const currentIndex = ['formulario', 'evidencias', 'firma'].indexOf(paso);
          const isCompleted = index < currentIndex;
          const isCurrent = paso === ['formulario', 'evidencias', 'firma'][index];

          return (
            <div
              key={label}
              className={`flex items-center ${
                isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-muted-foreground'
              }`}
            >
              <span className='mr-2 flex h-8 w-8 items-center justify-center rounded-full border-2'>
                {index + 1}
              </span>
              {label}
            </div>
          );
        })}
      </div>

      {paso === 'formulario' && (
        <form onSubmit={handleSubmit(onSubmitFormulario)} className='space-y-6'>
          <div className='mb-6 rounded-lg border border-border bg-muted p-4'>
            <h3 className='mb-2 font-semibold'>Activo a revisar</h3>
            <p>
              <strong>Código:</strong> {activo.codigo}
            </p>
            <p>
              <strong>Descripción:</strong> {activo.descripcion}
            </p>
            <p>
              <strong>Ubicación:</strong> {assetLocation.locationName}
            </p>
            <p>
              <strong>Custodio:</strong> {custodio.nombre}
            </p>
          </div>

          <div>
            <Label htmlFor='fecha'>Fecha de revisión</Label>
            <Input type='date' {...register('fecha')} />
            {errors.fecha && <p className='text-sm text-red-500'>{errors.fecha.message}</p>}
          </div>

          <div>
            <Label htmlFor='estadoActivo'>Estado del activo</Label>
            <Select {...register('estadoActivo')}>
              <option value='excelente'>Excelente</option>
              <option value='bueno'>Bueno</option>
              <option value='regular'>Regular</option>
              <option value='malo'>Malo</option>
              <option value='para_baja'>Para baja</option>
            </Select>
          </div>

          <div>
            <Label htmlFor='descripcion'>Descripción de la revisión</Label>
            <Textarea
              {...register('descripcion')}
              rows={4}
              placeholder='Describa detalladamente el estado del activo y los hallazgos de la revisión.'
            />
            {errors.descripcion && <p className='text-sm text-red-500'>{errors.descripcion.message}</p>}
          </div>

          <div>
            <Label htmlFor='observaciones'>Observaciones adicionales</Label>
            <Textarea
              {...register('observaciones')}
              rows={3}
              placeholder='Observaciones o recomendaciones adicionales.'
            />
          </div>

          <Button type='submit' disabled={loading} className='w-full'>
            {loading ? 'Guardando...' : 'Continuar a evidencias'}
          </Button>
        </form>
      )}

      {paso === 'evidencias' && (
        <div className='space-y-6'>
          <div>
            <h3 className='text-lg font-semibold'>Subir evidencias fotográficas</h3>
            <p className='text-muted-foreground'>
              Agregue entre 1 y 5 fotografías del activo revisado.
            </p>
          </div>

          <EvidenciasUploader evidencias={evidencias} onChange={setEvidencias} maxFiles={5} />

          <div className='flex gap-4'>
            <Button variant='outline' onClick={() => setPaso('formulario')}>
              Volver
            </Button>
            <Button
              onClick={handleSubirEvidencias}
              disabled={evidencias.length === 0 || loading}
              className='flex-1'
            >
              {loading ? 'Subiendo...' : 'Continuar a firma'}
            </Button>
          </div>
        </div>
      )}

      {paso === 'firma' && user?.usuario && (
        <SignaturePad
          titulo='Firma del profesional de logística'
          nombreFirmante={user.usuario.nombre}
          cedulaFirmante={user.usuario.cedula}
          declaracion='Certifico que realicé la revisión física del activo y que la información registrada corresponde a su estado real al momento de la inspección.'
          onSave={handleFirmaRevisor}
          onCancel={() => setPaso('evidencias')}
        />
      )}
    </div>
  );
}
