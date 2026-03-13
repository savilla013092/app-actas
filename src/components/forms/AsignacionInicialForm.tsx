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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import {
  EVIDENCE_FILE_ACCEPT,
  getEvidenceUploadErrorDescription,
} from '@/services/evidenceUploadService';
import {
  crearAsignacionInicial,
  firmarAsignacionComoRevisor,
  subirEvidenciasAsignacion,
} from '@/services/asignacionService';
import { Activo } from '@/types/activo';

const asignacionSchema = z.object({
  fecha: z.string().min(1, 'La fecha es requerida'),
  descripcion: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  observaciones: z.string().optional(),
});

type AsignacionFormData = z.infer<typeof asignacionSchema>;

interface AsignacionInicialFormProps {
  activo: Activo;
  custodio: {
    id: string;
    nombre: string;
    cedula: string;
    cargo: string;
  };
  onSuccess: (assignmentId: string) => void;
}

export function AsignacionInicialForm({
  activo,
  custodio,
  onSuccess,
}: AsignacionInicialFormProps) {
  const { user } = useAuth();
  const [paso, setPaso] = useState<'formulario' | 'evidencias' | 'firma'>('formulario');
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [evidencias, setEvidencias] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<AsignacionFormData>({
    resolver: zodResolver(asignacionSchema),
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmitFormulario = async (data: AsignacionFormData) => {
    if (!user?.usuario) {
      toast({
        title: 'Perfil no disponible',
        description: 'Debe iniciar sesión con un perfil operativo válido para crear asignaciones iniciales.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const id = await crearAsignacionInicial({
        activoId: activo.id,
        codigoActivo: activo.codigo,
        descripcionActivo: activo.descripcion,
        ubicacionActivo: activo.ubicacion,
        custodioId: custodio.id,
        custodioNombre: custodio.nombre,
        custodioCedula: custodio.cedula,
        custodioCargo: custodio.cargo,
        revisorId: user.uid,
        revisorNombre: user.usuario.nombre,
        revisorCedula: user.usuario.cedula,
        revisorCargo: user.usuario.cargo,
        fecha: new Date(data.fecha),
        descripcion: data.descripcion,
        observaciones: data.observaciones,
        estado: 'borrador',
        creadoPor: user.uid,
      });

      setAssignmentId(id);
      setPaso('evidencias');
    } catch (error) {
      console.error('Error creating initial assignment:', error);
      toast({
        title: 'No fue posible crear la asignación inicial',
        description: error instanceof Error ? error.message : 'Revise el estado del activo e intente nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubirEvidencias = async () => {
    if (!assignmentId) {
      return;
    }

    setLoading(true);

    try {
      await subirEvidenciasAsignacion(assignmentId, evidencias);
      setPaso('firma');
    } catch (error) {
      console.error('Error uploading assignment evidences:', error);
      toast({
        title: 'Error al subir evidencias',
        description: getEvidenceUploadErrorDescription(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFirmaRevisor = async (firmaDataUrl: string) => {
    if (!assignmentId) {
      return;
    }

    setLoading(true);

    try {
      const datosAsignacion = {
        ...getValues(),
        activo,
        custodio,
        revisor: user?.usuario,
        fecha: new Date().toISOString(),
      };

      await firmarAsignacionComoRevisor(assignmentId, firmaDataUrl, datosAsignacion);
      onSuccess(assignmentId);
    } catch (error) {
      console.error('Error registering assignment reviewer signature:', error);
      toast({
        title: 'No fue posible registrar la firma',
        description: 'La asignación quedó guardada, pero la firma del revisor no se pudo procesar.',
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
            <h3 className='mb-2 font-semibold'>Activo a asignar</h3>
            <p>
              <strong>Código:</strong> {activo.codigo}
            </p>
            <p>
              <strong>Descripción:</strong> {activo.descripcion}
            </p>
            <p>
              <strong>Ubicación:</strong> {activo.ubicacion}
            </p>
            <p>
              <strong>Custodio:</strong> {custodio.nombre}
            </p>
          </div>

          <div>
            <Label htmlFor='fecha'>Fecha de asignación</Label>
            <Input type='date' {...register('fecha')} />
            {errors.fecha && <p className='text-sm text-red-500'>{errors.fecha.message}</p>}
          </div>

          <div>
            <Label htmlFor='descripcion'>Descripción de entrega y recibo</Label>
            <Textarea
              {...register('descripcion')}
              rows={4}
              placeholder='Describa el estado de entrega del activo y las condiciones del recibo inicial.'
            />
            {errors.descripcion && <p className='text-sm text-red-500'>{errors.descripcion.message}</p>}
          </div>

          <div>
            <Label htmlFor='observaciones'>Observaciones adicionales</Label>
            <Textarea
              {...register('observaciones')}
              rows={3}
              placeholder='Observaciones o condiciones especiales de la asignación.'
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
              Agregue entre 1 y 5 fotografías del activo en su momento de entrega inicial.
            </p>
          </div>

          <EvidenciasUploader
            evidencias={evidencias}
            onChange={setEvidencias}
            maxFiles={5}
            accept={EVIDENCE_FILE_ACCEPT}
          />

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
          declaracion='Certifico que realicé la entrega inicial del activo y que la información registrada corresponde al estado en que fue entregado.'
          onSave={handleFirmaRevisor}
          onCancel={() => setPaso('evidencias')}
        />
      )}
    </div>
  );
}
